const crypto = require('crypto');
const fs = require('fs');
const { ChannelType, Events, escapeMarkdown } = require('discord.js');

// Bridges each game server's chat with its own thread in a forum channel, through the master's relay:
// the server's Event feed comes out as posts, and replies in the thread go back in with POST /say
module.exports = {
    name: 'bridge',
    config: {
        file: './db/bridge.json',
        master: 'https://play.redeclipse.net:28888',
        via: 'discord',
        webhook: 'Redroid Bridge',
        retry: 30000, // ms before reopening a closed socket
        offlinenote: 600000, // ms between notes that a thread's server is offline
        speakers: 500 // posts remembered for turning a reply into @name
    },
    bot: null,
    forum: null,
    hook: null,
    live: null,
    timers: new Set(),
    stopped: false,
    data: { threads: {} },
    servers: new Map(), // host:port -> { info, feed, token, thread, chain, retry, noted }
    speakers: new Map(), // Discord message id -> the player's name it was posted for

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
        const hooks = await forum.fetchWebhooks();
        this.hook = hooks.find(h => h.owner && h.owner.id === this.bot.user.id && h.token) ||
            await forum.createWebhook({ name: this.config.webhook, reason: 'Posts game chat under each player\'s name' });
        this.openlive();
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
            server = { key, info, feed: null, token: null, thread: null, chain: Promise.resolve(), retry: false, noted: 0 };
            this.servers.set(key, server);
        }
        const oldname = this.threadname(server.info);
        server.info = info;
        if (!this.eligible(info)) {
            this.closefeed(server);
            return;
        }
        if (!server.feed) this.openfeed(server);
        if (this.threadname(info) !== oldname) this.queue(server, () => this.rename(server));
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
        ws.addEventListener('message', event => {
            let msg;
            try {
                msg = JSON.parse(event.data);
            }
            catch {
                return;
            }
            this.queue(server, () => this.feedevent(server, msg));
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
    // Posts for one server go out in the order its events came
    queue(server, fun) {
        server.chain = server.chain.then(fun).catch(err => global.log.error(`Bridge: ${server.key}: ${err.stack || err}`));
    },

    // Game markup, such as colours and icons, has no meaning on Discord
    plain(str) {
        return String(str || '').replace(/\f(\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|.)/g, '').trim();
    },
    threadname(info) {
        const desc = info ? this.plain(info.description) : '';
        return (desc || (info ? this.key(info) : '')).slice(0, 100);
    },
    async thread(server, create) {
        if (server.thread) return server.thread;
        const id = this.data.threads[server.key];
        if (id) {
            const found = await this.forum.threads.fetch(id).catch(() => null);
            if (found) return server.thread = found;
        }
        if (!create) return null;
        const made = await this.forum.threads.create({
            name: this.threadname(server.info),
            message: { content: `Chat on **${escapeMarkdown(this.threadname(server.info))}** (${server.key}). Write here to talk to its players.` }
        });
        this.data.threads[server.key] = made.id;
        this.save();
        return server.thread = made;
    },
    async rename(server) {
        const thread = await this.thread(server, false);
        const name = this.threadname(server.info);
        if (thread && name && thread.name !== name) await thread.setName(name);
    },
    // A quiet thread is archived by Discord, and opened again for the next post
    async open(server) {
        const thread = await this.thread(server, true);
        if (thread.archived) await thread.setArchived(false);
        return thread;
    },

    async feedevent(server, msg) {
        if (!this.forum || !msg || !msg.event) return;
        const client = msg.client || {};
        const name = escapeMarkdown(this.plain(client.name) || 'someone');
        switch (msg.event) {
            case 'chat':
            case 'action': {
                if (client.bot) return;
                if (client.web && client.handle === this.bot.config.auth.handle) return; // our own, coming back
                const text = this.plain(msg.text);
                if (!text) return;
                const thread = await this.open(server);
                const sent = await this.hook.send({
                    threadId: thread.id,
                    username: this.username(client),
                    content: msg.event === 'action' ? `*${escapeMarkdown(text)}*` : escapeMarkdown(text),
                    allowedMentions: { parse: [] }
                });
                this.speakers.set(sent.id, this.plain(client.name));
                if (this.speakers.size > this.config.speakers) this.speakers.delete(this.speakers.keys().next().value);
                return;
            }
            case 'join':
            case 'leave': {
                if (client.bot) return;
                const thread = await this.open(server);
                const reason = msg.reason ? ` (${escapeMarkdown(msg.reason)})` : '';
                await thread.send({ content: `**${name}** ${msg.event === 'join' ? 'joined' : 'left'}${reason}`, allowedMentions: { parse: [] } });
                return;
            }
            case 'map': {
                const thread = await this.thread(server, false); // a map change alone doesn't start a thread
                if (!thread) return;
                if (thread.archived) await thread.setArchived(false);
                await thread.send({ content: `Now playing **${escapeMarkdown(this.plain(msg.mode))}** on **${escapeMarkdown(this.plain(msg.map))}**`, allowedMentions: { parse: [] } });
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
        // Discord refuses webhook names containing these
        return user.replace(/discord/gi, 'D1scord').replace(/clyde/gi, 'C1yde').slice(0, 80);
    },

    // Replies in a server's thread go to that server
    async message(message) {
        if (!this.forum || !message.channel || message.channel.parentId !== this.forum.id) return;
        if (message.author.bot || message.webhookId || message.system) return;
        const key = Object.keys(this.data.threads).find(k => this.data.threads[k] === message.channel.id);
        if (!key) return;
        const server = this.servers.get(key);
        if (!server || !this.eligible(server.info)) {
            if (server && Date.now() - server.noted < this.config.offlinenote) return;
            if (server) server.noted = Date.now();
            const why = server ? 'no longer takes chat from here' : 'is offline';
            await message.reply({ content: `That server ${why}, so this didn't reach it.`, allowedMentions: { parse: [] } });
            return;
        }
        let text = message.cleanContent.trim(), action = false;
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
        const err = await this.say(server, { text, from, via: this.config.via, action });
        if (err) await message.reply({ content: `That didn't reach the server: ${err}`, allowedMentions: { parse: [] } });
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

    // POST /say as the bot's account, signing in again when the session has run out
    async say(server, body) {
        for (let attempt = 0; attempt < 2; attempt++) {
            if (!server.token) {
                const err = await this.signin(server);
                if (err) return err;
            }
            const res = await this.post(server, '/say', body, server.token);
            if (res.status === 401) {
                server.token = null;
                continue;
            }
            if (res.status >= 200 && res.status < 300) return null;
            global.log.warn(`Bridge: ${server.key} refused a message: ${res.status} ${res.error}`);
            return res.error || `error ${res.status}`;
        }
        return 'couldn\'t sign in';
    },
    async signin(server) {
        const auth = this.bot.config.auth;
        const chal = await this.post(server, '/auth', { name: auth.handle });
        if (chal.status !== 200 || !chal.json || !chal.json.challenge) return `couldn't sign in (${chal.error || chal.status})`;
        const answer = this.answer(auth.privkey, chal.json.challenge);
        if (!answer) return 'couldn\'t answer the server\'s challenge';
        const done = await this.post(server, '/auth', { id: chal.json.id, answer });
        if (done.status !== 200 || !done.json || !done.json.token) return `couldn't sign in (${done.error || done.status})`;
        server.token = done.json.token;
        global.log.out(`Bridge: signed in to ${server.key} as ${done.json.name} (${done.json.privilege})`);
        return null;
    },
    async post(server, path, body, token) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        try {
            const res = await fetch(this.relayurl(server, path), { method: 'POST', headers, body: JSON.stringify(body) });
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
            return { status: 0, json: null, error: e.message };
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
