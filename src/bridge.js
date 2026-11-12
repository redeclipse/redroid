const crypto = require('crypto');
const fs = require('fs');
const { ChannelType, Events, MessageFlags, RESTJSONErrorCodes, RateLimitError, escapeMarkdown } = require('discord.js');

// Bridges each game server's chat with its own thread in a forum channel, through the master's relay:
// the server's Event feed comes out as posts, and replies in the thread go back in with POST /say
module.exports = {
    name: 'bridge',
    config: {
        file: './db/bridge.json',
        master: 'https://play.redeclipse.net:28888',
        via: 'discord',
        // the in-game Privilege shown by a Discord user's name, from the access level config.access gives them: the
        // highest listed at or below it, and none below them all
        privileges: { 1: 'none', 2: 'player', 3: 'supporter', 4: 'moderator', 5: 'administrator', 6: 'developer', 10: 'creator' },
        webhook: 'Red Eclipse Bridge',
        retry: 30000, // ms before reopening a closed socket
        offlinenote: 600000, // ms between notes that a thread's server is offline
        authwait: 300000, // ms before signing in to a server again after it refused, as repeated failures get our address banned
        speakers: 500, // posts remembered for turning a reply into @name
        discordgap: 600, // ms between posts to Discord, under a webhook's 5 every 2 seconds
        backlog: 100, // posts waiting for Discord before the oldest are dropped
        postsize: 2000, // characters in a Discord post
        gamegap: 300, // ms between messages to one game server
        usergap: 2000, // ms between one Discord user's messages to one game server, the game's 5 every 10 seconds
        userbacklog: 5, // one Discord user's messages waiting for one game server before more are refused
        renames: 2, // renames of one thread Discord allows every renamewindow
        renamewindow: 600000,
        pause: 600000, // ms a thread that refused the bot is left alone, as each refusal counts towards Discord's ban
        heldcheck: 500, // ms between looks at the queue while every post in it waits for a held thread, so new ones for other threads go on
        timeout: 10000 // ms before a request to a game server is given up
    },
    bot: null,
    forum: null,
    hook: null,
    live: null,
    timers: new Set(),
    stopped: false,
    data: { threads: {} },
    servers: new Map(), // host:port -> { info, feed, token, thread, retry, authfailed, outbox, users, pumping }
    noted: new Map(), // thread id -> when it was last told its server is offline
    speakers: new Map(), // Discord message id -> the player's name it was posted for
    outbox: [], // posts waiting for Discord: { server, kind, create, username, name, content, message }
    pumping: false,
    skipped: new Map(), // host:port -> posts dropped to keep up, told in its thread next
    renamed: new Map(), // thread id -> when it was last renamed, for the ones still inside renamewindow
    renaming: new Set(), // thread ids with a rename waiting for a slot
    held: new Map(), // thread id -> when Discord will take an edit to it again, its posts waiting until then
    paused: new Map(), // thread or forum id -> until when it is left alone for refusing the bot

    start(bot) {
        const auth = bot.config.auth || {};
        this.relay = auth.relay || (bot.config.channels || {}).relay;
        if (!auth.handle || !auth.privkey || !this.relay) {
            global.log.out('Bridge: auth.handle, auth.privkey and a forum channel in auth.relay or channels.relay are needed, not starting.');
            return false;
        }
        this.bot = bot;
        this.master = (auth.master || this.config.master).replace(/\/+$/, '');
        try {
            if (fs.existsSync(this.config.file)) this.data = JSON.parse(fs.readFileSync(this.config.file, 'utf-8'));
            if (!this.data.threads) this.data.threads = {};
        }
        catch (e) {
            global.log.error(e);
        }
        bot.once(Events.ClientReady, () => this.ready().catch(err => global.log.error(`Bridge: ${err.stack || err}`)));
        bot.on(Events.MessageCreate, message => this.message(message).catch(err => global.log.error(`Bridge: ${err.stack || err}`)));
        return true;
    },
    shutdown() {
        this.stopped = true;
        for (const timer of this.timers) clearTimeout(timer);
        this.timers.clear();
        if (this.live) this.live.close();
        for (const server of this.servers.values()) this.closefeed(server);
    },
    save() {
        return global.tools.writejson(this.config.file, this.data);
    },
    later(ms, fun) {
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            if (!this.stopped) fun();
        }, ms);
        this.timers.add(timer);
    },

    async ready() {
        const forum = await this.bot.channels.fetch(this.relay).catch(() => null);
        if (!forum || forum.type !== ChannelType.GuildForum) {
            global.log.warn(`Bridge: the relay channel (${this.relay}) is not a forum channel the bot can see.`);
            return;
        }
        this.forum = forum;
        await this.webhook();
        this.openlive();
    },
    // The bot's own webhook on the forum, made if there is none, as when a moderator deleted it
    async webhook() {
        this.hook = null;
        const hooks = await this.forum.fetchWebhooks();
        this.hook = hooks.find(h => h.owner && h.owner.id === this.bot.user.id && h.token) ||
            await this.forum.createWebhook({ name: this.config.webhook, reason: 'Posts game chat under each player\'s name' });
        return this.hook;
    },

    // The master's live server list says which servers exist and whether they take part
    openlive() {
        if (this.stopped) return;
        const ws = new WebSocket(this.master.replace(/^http/, 'ws') + '/api/v1/servers/live');
        this.live = ws;
        ws.addEventListener('message', event => {
            let msg;
            try {
                msg = JSON.parse(event.data);
            }
            catch {
                return;
            }
            if (msg.event === 'snapshot') {
                const seen = new Set();
                for (const info of msg.servers || []) {
                    seen.add(this.key(info));
                    this.update(info);
                }
                for (const [key, server] of this.servers) if (!seen.has(key)) this.remove(server);
            }
            else if (msg.event === 'add' || msg.event === 'update') {
                this.update(msg.server);
            }
            else if (msg.event === 'remove') {
                const server = this.servers.get(this.key(msg));
                if (server) this.remove(server);
            }
        });
        ws.addEventListener('close', () => {
            if (this.live !== ws || this.stopped) return;
            this.live = null;
            global.log.out('Bridge: the master\'s live list closed, reopening soon.');
            this.later(this.config.retry, () => this.openlive());
        });
        ws.addEventListener('error', () => ws.close());
    },
    key(info) {
        return `${info.host}:${info.port}`;
    },
    // Only servers that say they take bridged chat and allow signing in through the relay; older ones don't say
    eligible(info) {
        return info && info.bridge === 1 && info.relay >= 2;
    },
    update(info) {
        const key = this.key(info);
        let server = this.servers.get(key);
        if (!server) {
            server = { key, info, feed: null, token: null, thread: null, retry: false, authfailed: 0, outbox: [], users: new Map(), pumping: false };
            this.servers.set(key, server);
        }
        const oldname = this.threadname(server.info);
        server.info = info;
        if (!this.eligible(info)) {
            this.closefeed(server);
            return;
        }
        if (!server.feed && !server.retry) this.openfeed(server); // a failing feed waits for its retry, as updates come often
        if (this.threadname(info) !== oldname) this.rename(server).catch(err => global.log.error(`Bridge: ${key}: ${err.stack || err}`));
    },
    remove(server) {
        this.closefeed(server);
        this.servers.delete(server.key);
    },
    relayurl(server, path) {
        return `${this.master}/relay/${encodeURIComponent(server.info.host)}/${server.info.port}/api/v1${path}`;
    },

    openfeed(server) {
        if (this.stopped) return;
        const ws = new WebSocket(this.relayurl(server, '/events').replace(/^http/, 'ws'));
        server.feed = ws;
        server.count = undefined; // joins and leaves may have been missed while it was closed
        ws.addEventListener('message', event => {
            let msg;
            try {
                msg = JSON.parse(event.data);
            }
            catch {
                return;
            }
            this.feedevent(server, msg);
        });
        ws.addEventListener('close', () => {
            if (server.feed !== ws) return;
            server.feed = null;
            if (server.retry || this.stopped) return;
            server.retry = true;
            this.later(this.config.retry, () => {
                server.retry = false;
                if (this.servers.get(server.key) === server && this.eligible(server.info) && !server.feed) this.openfeed(server);
            });
        });
        ws.addEventListener('error', () => ws.close());
    },
    closefeed(server) {
        if (!server.feed) return;
        const ws = server.feed;
        server.feed = null;
        ws.close();
    },
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // Everything for Discord waits its turn here, one post every discordgap, in the order it came for each thread;
    // a thread Discord won't edit yet keeps its posts waiting while the others go on
    post(item) {
        if (this.paused.get(this.pausekey(item)) > Date.now()) return;
        this.outbox.push(item);
        if (this.outbox.length > this.config.backlog) {
            // the oldest go first, and their thread is told how many
            const i = this.outbox.findIndex(o => o.kind === 'chat' || o.kind === 'line');
            if (i >= 0) {
                const [gone] = this.outbox.splice(i, 1);
                this.skipped.set(gone.server.key, (this.skipped.get(gone.server.key) || 0) + 1);
            }
        }
        this.pump().catch(err => global.log.error(`Bridge: ${err.stack || err}`));
    },
    async pump() {
        if (this.pumping) return;
        this.pumping = true;
        while (this.outbox.length && !this.stopped) {
            const item = this.take();
            if (!item) {
                // a short wait, not until the hold ends, as posts for other threads may come meanwhile
                await this.wait(Math.max(50, Math.min(this.config.heldcheck, Math.min(...this.held.values()) - Date.now())));
                continue;
            }
            try {
                await this.deliver(item);
            }
            catch (err) {
                if (err instanceof RateLimitError && this.threadid(item)) {
                    this.held.set(this.threadid(item), Date.now() + (err.sublimitTimeout || err.retryAfter));
                    this.outbox.unshift(item);
                    continue;
                }
                if (err && (err.code === RESTJSONErrorCodes.MissingAccess || err.code === RESTJSONErrorCodes.MissingPermissions)) {
                    const key = this.pausekey(item);
                    this.paused.set(key, Date.now() + this.config.pause);
                    const before = this.outbox.length;
                    this.outbox = this.outbox.filter(o => this.pausekey(o) !== key);
                    global.log.warn(`Bridge: <#${key}> refused the bot (${err.message}), dropping ${before - this.outbox.length + 1} posts and leaving it alone for ${this.config.pause / 60000} minutes.`);
                    await this.wait(this.config.discordgap);
                    continue;
                }
                // a thread a moderator deleted is made again, and the post tried once more there
                if (err && err.code === RESTJSONErrorCodes.UnknownChannel && item.server) {
                    this.forget(item.server);
                    await this.deliver(item).catch(e => global.log.error(`Bridge: ${item.server.key}: ${e.stack || e}`));
                }
                // and so is a webhook a moderator deleted, rather than every chat post failing until a restart
                else if (err && err.code === RESTJSONErrorCodes.UnknownWebhook && item.kind === 'chat') {
                    global.log.warn('Bridge: the webhook for game chat was deleted, making another.');
                    await this.webhook().then(() => this.deliver(item)).catch(e => global.log.error(`Bridge: ${item.server.key}: ${e.stack || e}`));
                }
                else {
                    global.log.error(`Bridge: ${item.server ? item.server.key : 'reply'}: ${err.stack || err}`);
                }
            }
            await this.wait(this.config.discordgap);
        }
        this.pumping = false;
    },
    // The next post, with the ones after it in the same thread from the same sender joined on, so a burst takes fewer posts
    take() {
        const now = Date.now();
        for (const [id, until] of this.held) if (until <= now) this.held.delete(id);
        const at = this.outbox.findIndex(o => !this.held.has(this.threadid(o)));
        if (at < 0) return null;
        const [head] = this.outbox.splice(at, 1);
        if (head.kind !== 'chat' && head.kind !== 'line') return head;
        for (let i = at; i < this.outbox.length;) {
            const o = this.outbox[i];
            if (o.server !== head.server) {
                i++; // other threads keep their places
                continue;
            }
            // anything else in this thread ends the run, so it keeps its order; a run of joins, leaves and map changes
            // is one post, keeping the bot under Discord's 5 posts every 5 seconds in a channel
            if (o.kind !== head.kind || o.username !== head.username) break;
            if (head.content.length + 1 + o.content.length > this.config.postsize) break;
            head.content += '\n' + o.content;
            head.create = head.create || o.create; // the run starts a thread if any of it would
            this.outbox.splice(i, 1);
        }
        return head;
    },
    // The thread a post goes to, if it has one yet
    threadid(item) {
        return item.message ? item.message.channelId : this.data.threads[item.server.key];
    },
    // What is left alone when Discord refuses a post: its thread, or the forum while it has none
    pausekey(item) {
        return this.threadid(item) || this.relay;
    },
    async deliver(item) {
        if (item.kind === 'reply') {
            await item.message.reply({ content: item.content, allowedMentions: { parse: [] } });
            return;
        }
        // a map change alone doesn't start a thread
        if (!item.create && !await this.thread(item.server, false)) return;
        const thread = await this.open(item.server);
        const skipped = this.skipped.get(item.server.key);
        if (skipped) {
            this.skipped.delete(item.server.key);
            await thread.send({ content: `*${skipped} ${skipped === 1 ? 'post was' : 'posts were'} skipped to keep up.*`, allowedMentions: { parse: [] } });
        }
        // no link previews, so a link from the game is only text
        if (item.kind === 'chat') {
            if (!this.hook) await this.webhook();
            const sent = await this.hook.send({ threadId: thread.id, username: item.username, content: item.content, allowedMentions: { parse: [] }, flags: MessageFlags.SuppressEmbeds });
            this.speakers.set(sent.id, item.name);
            if (this.speakers.size > this.config.speakers) this.speakers.delete(this.speakers.keys().next().value);
        }
        else {
            await thread.send({ content: item.content, allowedMentions: { parse: [] }, flags: MessageFlags.SuppressEmbeds });
        }
    },
    reply(message, content) {
        this.post({ kind: 'reply', message, content });
    },
    forget(server) {
        server.thread = null;
        if (!this.data.threads[server.key]) return;
        delete this.data.threads[server.key];
        this.save();
    },
    // How many are on a server: what its last join or leave said, or else the master's list, which lags a little
    players(server) {
        if (typeof server.count === 'number') return server.count;
        const status = server.info && server.info.status;
        return status && Array.isArray(status.players) ? status.players.length : 0;
    },

    // Game markup, such as colours and icons, has no meaning on Discord,
    // and line breaks become spaces, as older builds let web chat start a line that would look like a post of its own
    plain(str) {
        return String(str || '').replace(/\f(\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|.)/g, '').replace(/\s+/g, ' ').trim();
    },
    // Game text as Discord shows it, with nothing taken as markdown: escapeMarkdown leaves headings, lists and masked
    // links alone unless asked, and doesn't know subtext (-#) or quotes (>) at all; each piece starts a line of its post
    escape(str) {
        return escapeMarkdown(str, { heading: true, bulletedList: true, numberedList: true, maskedLink: true }).replace(/^(-#|>)/, '\\$1');
    },
    threadname(info) {
        const desc = info ? this.plain(info.description) : '';
        return (desc || (info ? this.key(info) : '')).slice(0, 100);
    },
    async thread(server, create) {
        if (server.thread) return server.thread;
        const id = this.data.threads[server.key];
        if (id) {
            // only a thread Discord says is gone is made again; any other failure, such as a network error, is thrown,
            // as making one then would leave the server with two threads
            try {
                const found = await this.forum.threads.fetch(id);
                if (found) return server.thread = found;
            }
            catch (err) {
                if (!err || err.code !== RESTJSONErrorCodes.UnknownChannel) throw err;
                this.forget(server);
            }
        }
        if (!create) return null;
        const made = await this.forum.threads.create({
            name: this.threadname(server.info),
            message: { content: `Chat on **${this.escape(this.threadname(server.info))}** (${server.key}). Write here to talk to its players.` }
        });
        this.data.threads[server.key] = made.id;
        this.save();
        return server.thread = made;
    },
    // Discord allows a thread two renames every 10 minutes, so one past that waits for a slot, then takes the name the server has by then
    async rename(server) {
        const thread = await this.thread(server, false);
        const name = this.threadname(server.info);
        if (!thread || thread.archived || !name || thread.name === name) return; // an archived one is renamed when opened
        if (this.renaming.has(thread.id)) return;
        const now = Date.now();
        const times = (this.renamed.get(thread.id) || []).filter(t => now - t < this.config.renamewindow);
        this.renamed.set(thread.id, times);
        if (times.length >= this.config.renames) {
            this.renamelater(server, thread, times[0] + this.config.renamewindow - now);
            return;
        }
        times.push(now);
        try {
            await thread.setName(name);
        }
        catch (err) {
            if (err instanceof RateLimitError) this.renamelater(server, thread, err.sublimitTimeout || err.retryAfter);
            else if (err && err.code === RESTJSONErrorCodes.UnknownChannel) this.forget(server);
            else throw err;
        }
    },
    renamelater(server, thread, ms) {
        this.renaming.add(thread.id);
        this.later(ms, () => {
            this.renaming.delete(thread.id);
            this.rename(server).catch(err => global.log.error(`Bridge: ${server.key}: ${err.stack || err}`));
        });
    },
    // A quiet thread is archived by Discord, and opened again for the next post
    async open(server) {
        const thread = await this.thread(server, true);
        if (thread.archived) {
            await thread.setArchived(false);
            this.rename(server).catch(err => global.log.error(`Bridge: ${server.key}: ${err.stack || err}`));
        }
        return thread;
    },

    feedevent(server, msg) {
        if (!this.forum || !msg || !msg.event) return;
        const client = msg.client || {};
        const name = this.escape(this.plain(client.name) || 'someone');
        switch (msg.event) {
            case 'chat':
            case 'action': {
                if (client.bot) return;
                if (client.web && client.handle === this.bot.config.auth.handle) return; // our own, coming back
                const text = this.plain(msg.text);
                if (!text) return;
                const content = msg.event === 'action' ? `*${this.escape(text)}*` : this.escape(text);
                this.post({ server, kind: 'chat', create: true, username: this.username(client), name: this.plain(client.name), content });
                return;
            }
            case 'join':
            case 'leave': {
                if (typeof msg.players === 'number') server.count = msg.players; // bots' too, as it counts the people
                if (client.bot) return;
                const reason = msg.reason ? ` (${this.escape(this.plain(msg.reason))})` : '';
                // how many are on after it, from servers new enough to say
                const count = typeof msg.players === 'number' ? ` (${msg.players} ${msg.players === 1 ? 'player' : 'players'})` : '';
                this.post({ server, kind: 'line', create: true, content: `**${name}** ${msg.event === 'join' ? 'joined' : 'left'}${reason}${count}` });
                return;
            }
            case 'map': {
                if (!this.players(server)) return; // empty servers rotate maps with nobody to tell
                this.post({ server, kind: 'line', create: false, content: `Now playing **${this.escape(this.plain(msg.mode))}** on **${this.escape(this.plain(msg.map))}**` });
                return;
            }
            default:
                return;
        }
    },
    // A player signed in to an account shows it, so someone in game can't pass for a player who has one
    username(client) {
        const name = this.plain(client.name) || 'someone';
        let user = client.handle ? `${name} (${client.handle})` : `${name} (in game)`;
        if (client.web) user = `${name} [${client.via || 'web'}]`;
        // Discord refuses webhook names containing these, or that are these
        user = user.replace(/discord/gi, 'D1scord').replace(/clyde/gi, 'C1yde').slice(0, 80);
        return /^(everyone|here)$/i.test(user) ? `${user} (in game)` : user;
    },

    // Replies in a server's thread go to that server
    async message(message) {
        if (!this.forum || !message.channel || message.channel.parentId !== this.forum.id) return;
        if (message.author.bot || message.webhookId || message.system) return;
        if (global.access.level(message.guild, message.author) < 0) return; // blocked from the bot, so from the game too
        const key = Object.keys(this.data.threads).find(k => this.data.threads[k] === message.channel.id);
        if (!key) return;
        const server = this.servers.get(key);
        if (!server || !this.eligible(server.info)) {
            if (Date.now() - (this.noted.get(message.channel.id) || 0) < this.config.offlinenote) return;
            this.noted.set(message.channel.id, Date.now());
            const why = server ? 'no longer takes chat from here' : 'is offline';
            this.reply(message, `That server ${why}, so this didn't reach it.`);
            return;
        }
        let text = message.cleanContent.replace(/<a?(:\w+:)\d+>/g, '$1').trim(), action = false; // custom emoji by name
        const italic = text.match(/^\*([^*][\s\S]*)\*$/) || text.match(/^_([^_][\s\S]*)_$/);
        if (italic) {
            text = italic[1].trim();
            action = true;
        }
        for (const attached of message.attachments.values()) text += ` [${attached.name || 'attachment'}]`;
        text = text.replace(/\s+/g, ' ').trim();
        if (!text) return;
        const to = await this.replyto(message);
        if (to) text = `@${to} ${text}`;
        const from = (message.member && message.member.displayName) || message.author.globalName || message.author.username;
        this.send(server, { user: message.author.id, message, body: { text, from, via: this.config.via, action, privilege: this.privilege(message) } });
    },

    // Messages for a game server wait their turn: one every gamegap, and each Discord user's no more often than usergap,
    // so one busy user doesn't hold up the others or trip the game's limits
    send(server, item) {
        if (server.outbox.filter(o => o.user === item.user).length >= this.config.userbacklog) {
            this.reply(item.message, 'You\'re writing faster than the game takes chat, so that one wasn\'t sent.');
            return;
        }
        server.outbox.push(item);
        this.pumpgame(server).catch(err => global.log.error(`Bridge: ${server.key}: ${err.stack || err}`));
    },
    async pumpgame(server) {
        if (server.pumping) return;
        server.pumping = true;
        while (server.outbox.length && !this.stopped) {
            if (this.servers.get(server.key) !== server || !this.eligible(server.info)) {
                for (const item of server.outbox.splice(0)) this.reply(item.message, 'That server went away before this reached it.');
                break;
            }
            const now = Date.now(), ready = o => now - (server.users.get(o.user) || 0) >= this.config.usergap;
            const i = server.outbox.findIndex(ready);
            if (i < 0) {
                const soonest = Math.min(...server.outbox.map(o => this.config.usergap - (now - (server.users.get(o.user) || 0))));
                await this.wait(Math.max(soonest, 50));
                continue;
            }
            const [item] = server.outbox.splice(i, 1);
            for (const [user, when] of server.users) if (Date.now() - when > this.config.usergap) server.users.delete(user);
            server.users.set(item.user, Date.now());
            const done = await this.say(server, item.body);
            if (done.error) this.reply(item.message, `That didn't reach the server: ${done.error}`);
            else if (done.cut) this.reply(item.message, `That was too long for the game, so only its first ${done.cut} characters reached it, ending with ...`);
            await this.wait(this.config.gamegap);
        }
        server.pumping = false;
    },
    privilege(message) {
        const level = global.access.level(message.guild, message.author);
        let best = -Infinity, name = 'none';
        for (const [at, priv] of Object.entries(this.config.privileges)) {
            if (Number(at) <= level && Number(at) > best) {
                best = Number(at);
                name = priv;
            }
        }
        return name;
    },
    async replyto(message) {
        const ref = message.reference && message.reference.messageId;
        if (!ref) return null;
        if (this.speakers.has(ref)) return this.speakers.get(ref);
        const orig = await message.channel.messages.fetch(ref).catch(() => null);
        if (!orig || orig.author.id === this.bot.user.id) return null;
        if (orig.webhookId) return orig.author.username.replace(/ [([].*$/, '');
        return (orig.member && orig.member.displayName) || orig.author.globalName || orig.author.username;
    },

    // POST /say as the bot's account, signing in again when the session has run out; gives { error } or { cut }, the
    // characters kept when the game had to shorten it
    async say(server, body) {
        for (let attempt = 0; attempt < 2; attempt++) {
            if (!server.token) {
                if (Date.now() - server.authfailed < this.config.authwait) return { error: 'couldn\'t sign in, trying again in a few minutes' };
                const err = await this.signin(server);
                if (err) {
                    server.authfailed = Date.now();
                    return { error: err };
                }
            }
            const res = await this.request(server, '/say', body, server.token);
            if (res.status === 401) {
                server.token = null;
                continue;
            }
            if (res.status >= 200 && res.status < 300) return { cut: res.json && res.json.cut };
            global.log.warn(`Bridge: ${server.key} refused a message: ${res.status} ${res.error}`);
            return { error: res.error || `error ${res.status}` };
        }
        return { error: 'couldn\'t sign in' };
    },
    async signin(server) {
        const auth = this.bot.config.auth;
        const chal = await this.request(server, '/auth', { name: auth.handle });
        if (chal.status !== 200 || !chal.json || !chal.json.challenge) return `couldn't sign in (${chal.error || chal.status})`;
        const answer = this.answer(auth.privkey, chal.json.challenge);
        if (!answer) return 'couldn\'t answer the server\'s challenge';
        const done = await this.request(server, '/auth', { id: chal.json.id, answer });
        if (done.status !== 200 || !done.json || !done.json.token) return `couldn't sign in (${done.error || done.status})`;
        server.token = done.json.token;
        global.log.out(`Bridge: signed in to ${server.key} as ${done.json.name} (${done.json.privilege})`);
        return null;
    },
    async request(server, path, body, token) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        try {
            // a server that never answers would otherwise hold up everything else waiting for it
            const res = await fetch(this.relayurl(server, path), { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(this.config.timeout) });
            let json = null;
            try {
                json = await res.json();
            }
            catch {
                json = null;
            }
            return { status: res.status, json, error: json && json.error };
        }
        catch (e) {
            return { status: 0, json: null, error: e.name === 'TimeoutError' ? 'the server took too long to answer' : e.message };
        }
    },
    // The game's challenge is a point on P-192, a sign for y's parity then x in hex, and its answer the x of that point
    // times the private key, which is what ECDH gives with the point as the other side's public key
    answer(privkey, challenge) {
        try {
            const ecdh = crypto.createECDH('prime192v1');
            ecdh.setPrivateKey(Buffer.from(privkey.padStart(48, '0'), 'hex'));
            const point = Buffer.concat([Buffer.from([challenge[0] === '-' ? 3 : 2]), Buffer.from(challenge.slice(1).padStart(48, '0'), 'hex')]);
            return ecdh.computeSecret(point).toString('hex');
        }
        catch (e) {
            global.log.error(`Bridge: ${e.message}`);
            return null;
        }
    }
};
