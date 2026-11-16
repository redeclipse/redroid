const tools = require('./tools'); // global.tools, which starts after this does
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Events, escapeMarkdown } = require('discord.js');

// The Matchmaking thread: a pinned post in the bridge's forum whose first message lists the servers and whose second is the
// master's Matchmaking Queue, which members join from its buttons through the Red Eclipse account they linked; the master owns
// the queue, and this only shows it and passes on what members ask of it, signed in with the bridge's account so it may queue
// them by their Discord ID
// The Thresholds the master takes
const thresholds = [2, 4, 6, 8];
// Discord's limit on an embed's description, less room for the lines after the list
const LISTROOM = 3600;

module.exports = {
    name: 'matchmaking',
    config: null, // config.matchmaking, with the role from config.roles.matchmaking
    thresholds,
    bot: null,
    forum: null,
    thread: null,
    live: null,
    token: null,
    stopped: false,
    timers: new Set(),
    data: { thread: null, list: null, queue: null, reminders: {} },
    servers: new Map(), // host:port -> the master's listing
    queue: null, // the master's last queue event's queue, with its entries
    known: null, // handles in the last queue event since connecting, to tell who's new; null until the first
    waiting: new Map(), // Discord ID -> the button waiting to hear the master's answer
    lastlist: '',
    lastqueue: '',

    start(bot) {
        const auth = bot.config.auth || {};
        this.forumid = auth.relay || (bot.config.channels || {}).relay;
        this.config = bot.config.matchmaking;
        if (!auth.handle || !auth.privkey || !auth.master || !this.forumid || !this.config) {
            global.log.out('Matchmaking: auth.handle, auth.privkey, auth.master, the bridge\'s forum channel and config.matchmaking are needed, not starting.');
            return false;
        }
        this.config = Object.assign({}, this.config, { role: (bot.config.roles || {}).matchmaking });
        this.bot = bot;
        this.master = auth.master.replace(/\/+$/, '');
        const parsed = tools.readjson(this.config.file);
        if (parsed) this.data = Object.assign(this.data, parsed);
        bot.once(Events.ClientReady, () => this.ready().catch(err => global.log.error(`Matchmaking: ${err.stack || err}`)));
        bot.on(Events.ThreadUpdate, (before, after) => this.threadupdate(after).catch(err => global.log.error(`Matchmaking: ${err.stack || err}`)));
        bot.on(Events.MessageCreate, message => this.message(message).catch(err => global.log.error(`Matchmaking: ${err.stack || err}`)));
        this.ticker = setInterval(() => this.tick().catch(err => global.log.error(`Matchmaking: ${err.stack || err}`)), this.config.refresh);
        return true;
    },
    shutdown() {
        this.stopped = true;
        clearInterval(this.ticker);
        for (const timer of this.timers) clearTimeout(timer);
        this.timers.clear();
        if (this.live) this.live.close();
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
        const forum = await this.bot.channels.fetch(this.forumid).catch(() => null);
        if (!forum || forum.type !== ChannelType.GuildForum) {
            global.log.warn(`Matchmaking: the forum channel (${this.forumid}) is not a forum the bot can see.`);
            return;
        }
        this.forum = forum;
        await this.ensure();
        await this.connect();
    },

    // The thread and its two messages, made again if a moderator deleted any of them
    async ensure() {
        if (this.data.thread) this.thread = await this.forum.threads.fetch(this.data.thread).catch(() => null);
        if (!this.thread) {
            this.thread = await this.forum.threads.create({
                name: this.config.title,
                autoArchiveDuration: 10080,
                message: { embeds: [this.listembed()] }
            });
            this.data.thread = this.thread.id;
            this.data.list = this.thread.id; // a forum post's first message has the thread's id
            this.data.queue = null;
            this.save();
            await this.thread.pin().catch(err => global.log.warn(`Matchmaking: couldn't pin the thread: ${err.message}`));
        }
        if (this.thread.archived) await this.thread.setArchived(false);
        // @Matchmaking pings the bot sent before it stopped sending them
        if (Array.isArray(this.data.pings)) {
            for (const p of this.data.pings) await this.thread.messages.delete(typeof p === 'string' ? p : p.id).catch(() => null);
            delete this.data.pings;
            delete this.data.lastping;
            this.save();
        }
        let queuemsg = this.data.queue ? await this.thread.messages.fetch(this.data.queue).catch(() => null) : null;
        if (!queuemsg) {
            queuemsg = await this.thread.send(this.queuemessage());
            this.data.queue = queuemsg.id;
            this.save();
        }
        this.lastlist = '';
        this.lastqueue = '';
        await this.tick();
        await this.editqueue();
    },
    // The thread only holds the queue, so anything else said there goes, with a note that deletes itself saying where to talk,
    // as even someone who may post there needn't know it isn't for talking; the note names them without mentioning them
    async message(message) {
        if (!this.thread || message.channelId !== this.thread.id || message.author.id === this.bot.user.id || message.system) return;
        await message.delete().catch(err => global.log.warn(`Matchmaking: couldn't delete a message in the thread: ${err.message}`));
        const note = await this.thread.send({ content: `<@${message.author.id}> this thread only holds the queue, so your message was removed. Talk about a match in its server's thread.`, allowedMentions: { parse: [] } }).catch(() => null);
        if (note) this.later(this.config.notewait, () => note.delete().catch(() => null));
    },
    // Discord archives a quiet thread, which would take it off the top of the forum
    async threadupdate(thread) {
        if (!this.thread || thread.id !== this.thread.id || !thread.archived) return;
        await thread.setArchived(false);
    },

    // Signed in with the bridge's account on the master itself, so the live list carries the queue's entries and takes
    // members' places; without that it still shows the counts
    async signin() {
        const res = global.accounts ? await global.accounts.mastersession() : { status: 0, error: 'accounts aren\'t set up' };
        if (res.status === 200 && res.json && res.json.token) {
            global.log.out(`Matchmaking: signed in to the master as ${res.json.name} (${res.json.privilege})`);
            return res.json.token;
        }
        global.log.warn(`Matchmaking: couldn't sign in to the master, showing the queue without taking places: ${res.error || res.status}`);
        return null;
    },
    async connect() {
        if (this.stopped) return;
        this.token = await this.signin();
        let url = this.master.replace(/^http/, 'ws') + '/api/v1/servers/live';
        if (this.token) url += `?token=${encodeURIComponent(this.token)}`;
        const ws = new WebSocket(url);
        this.live = ws;
        ws.addEventListener('message', event => {
            let msg;
            try {
                msg = JSON.parse(event.data);
            }
            catch {
                return;
            }
            this.event(msg).catch(err => global.log.error(`Matchmaking: ${err.stack || err}`));
        });
        ws.addEventListener('close', () => {
            if (this.live !== ws || this.stopped) return;
            this.live = null;
            this.known = null;
            this.later(this.config.retry, () => this.connect());
        });
        ws.addEventListener('error', () => ws.close());
    },
    send(msg) {
        if (!this.live || this.live.readyState !== WebSocket.OPEN) return false;
        this.live.send(JSON.stringify(msg));
        return true;
    },

    async event(msg) {
        const key = s => `${s.host}:${s.port}`;
        switch (msg.event) {
            case 'snapshot':
                this.servers = new Map((msg.servers || []).map(s => [key(s), s]));
                break;
            case 'add': case 'update':
                if (msg.server) this.servers.set(key(msg.server), msg.server);
                break;
            case 'remove':
                this.servers.delete(key(msg));
                break;
            case 'queue':
                this.queue = msg.queue || null;
                this.queuechanged();
                this.joined();
                break;
            case 'queued': case 'unqueued': {
                const waiter = msg.discord && this.waiting.get(msg.discord);
                if (waiter) {
                    this.waiting.delete(msg.discord);
                    waiter(msg);
                }
                if (msg.event === 'unqueued') {
                    this.left(msg);
                    if (msg.discord) await this.unremind(msg.discord);
                }
                break;
            }
            case 'pop':
                await this.pop(msg);
                break;
        }
    },

    // Every refresh: the list, edited when it reads differently, and reminders for places about to run out
    async tick() {
        if (!this.thread) return;
        const embed = this.listembed(), text = JSON.stringify(embed);
        if (text !== this.lastlist) {
            const first = await this.thread.messages.fetch(this.data.list).catch(() => null);
            if (first) {
                await first.edit({ embeds: [embed], components: [] });
                this.lastlist = text;
            }
            else {
                await this.recreate();
            }
        }
        await this.reminders();
    },
    async recreate() {
        this.data.thread = this.data.list = this.data.queue = null;
        this.thread = null;
        this.save();
        await this.ensure();
    },

    plain(str) {
        return global.bridge.plain(str);
    },
    escape(str) {
        return global.bridge.escape(str);
    },
    bounce(server) {
        return `${this.master}/join/${encodeURIComponent(server.host)}/${server.port}`;
    },
    people(server) {
        return server.status && Array.isArray(server.status.players) ? server.status.players.length : 0;
    },
    // A server as its name, linked to its bounce link, over what it's playing, with its mode's and mutators' icons, and how full
    // it is; a name's brackets go, as Discord shows a link's escaped brackets as they are
    serverlines(server) {
        const name = escapeMarkdown(this.plain(server.description) || `${server.host}:${server.port}`).replace(/[[\]]/g, '');
        const st = server.status;
        const details = [];
        if (st) {
            const mode = global.modes.name(st);
            if (mode) details.push(`${global.modes.icons(st)}${mode}`);
            details.push(`${this.people(server)}/${st.maxplayers} playing`);
            if (Array.isArray(st.build) && st.build.length >= 3) details.push(`v${st.build.slice(0, 3).join('.')}${server.channel ? ` ${server.channel}` : ''}`);
        }
        return `**[${name}](<${this.bounce(server)}>)**` + (details.length ? `\n${details.join(', ')}` : '');
    },
    // only the servers the queue sends people to, which the master marks with their channel
    listembed() {
        const all = [...this.servers.values()].filter(s => s.channel);
        const busy = all.filter(s => this.people(s) > 0).sort((a, b) => this.people(b) - this.people(a) || b.priority - a.priority);
        const empty = all.filter(s => !this.people(s)).sort((a, b) => b.priority - a.priority);
        const shown = [...busy, ...empty].slice(0, Math.max(this.config.shown, busy.length));
        const blocks = [];
        let size = 0;
        for (const server of shown) {
            const block = this.serverlines(server);
            if (size + block.length + 2 > 3600) break;
            blocks.push(block);
            size += block.length + 2;
        }
        const more = all.length - blocks.length, moreempty = blocks.length >= busy.length;
        if (!blocks.length) blocks.push(this.servers.size || this.live ? 'No servers are taking matches right now.' : 'Waiting for the server list.');
        const tail = [];
        if (more > 0) tail.push(`and ${more} more ${moreempty ? 'empty ' : ''}${more === 1 ? 'server' : 'servers'}.`);
        tail.push(`[See more on the Server Browser](<${this.config.browser}>)`);
        return { title: 'Server List', description: blocks.join('\n\n') + '\n\n' + tail.join('\n'), color: this.config.colour };
    },

    // The channels the master has, each a version's servers and players
    channels() {
        return this.queue && Array.isArray(this.queue.channels) ? this.queue.channels : [];
    },
    versionnote(c) {
        const branch = c.name === 'release' ? 'the default branch has it' : `switch to the ${c.name} branch to join them`;
        return `Matches are played on the ${c.name} version (v${c.version}). On Steam, ${branch}.`;
    },
    channelname(c) {
        return `${c.name[0].toUpperCase()}${c.name.slice(1)} (v${c.version})`;
    },
    // The game's own wording, so the queue reads the same everywhere, a line for each channel when there's more than one
    counts() {
        if (!this.queue) return 'The queue isn\'t reachable right now.';
        const channels = this.channels();
        if (!channels.length) return 'The queue isn\'t open right now.';
        const line = c => {
            if (c.next && c.next.needed) return `${c.ready} waiting, ${c.next.needed} more needed for a ${c.next.threshold}+ match`;
            return c.ready ? `${c.ready} waiting` : 'Nobody is waiting yet';
        };
        // one channel is the only version anyone can be matched on, so it says which and how to get it; with more, each row is named
        if (channels.length === 1) return `${line(channels[0])}.\n${this.versionnote(channels[0])}`;
        return channels.map(c => `**${this.channelname(c)}:** ${line(c)}`).join('\n');
    },
    // Who's waiting, as the game shows them: their Privilege's icon, display name or handle, then the handle, match size and
    // where they are; as many as fit, then how many more
    waitinglines() {
        const entries = this.queue && Array.isArray(this.queue.entries) ? this.queue.entries : [];
        const channels = this.channels().length > 1;
        const lines = [];
        let size = 0, i = 0;
        for (; i < entries.length; i++) {
            const e = entries[i];
            const where = e.state === 'held' ? ', on a server' : e.state === 'travelling' ? ', on the way' : '';
            const line = `${this.who(e)} ${channels ? `${e.channel} ` : ''}${e.threshold}+${where}`;
            if (size + line.length + 1 > LISTROOM) break;
            lines.push(line);
            size += line.length + 1;
        }
        if (i < entries.length) lines.push(`and ${entries.length - i} more.`);
        return lines;
    },
    // How someone without a linked account gets one, for the queue message and the reply to their button
    accounthelp() {
        return `You need a Red Eclipse account to queue. Register one on the Account page of the game's Player menu or at <${this.config.account}>, then link it here with \`/link\` and the code it gives you. Already have an account? Just \`/link\` it.`;
    },
    queuemessage() {
        const waiting = this.waitinglines();
        const embed = {
            title: 'Matchmaking Queue',
            description: 'Pick a match size to enter the queue for matchmaking. You\'ll be mentioned in that server\'s thread when it\'s time to join, and your place lasts 60 minutes. ' +
                `Queuing needs a Red Eclipse account linked with \`/link\`, [registered in the game or on the website](<${this.config.account}>).` +
                (this.bot.config.channels.findplayers ? ` <#${this.bot.config.channels.findplayers}> shows who joins or leaves the queue and the servers.` : '') +
                (this.config.role ? ' Members mention @Matchmaking when they want more players: Get @Matchmaking Pings to hear them, and Stop @Matchmaking Pings to stop.' : '') +
                '\n\n' + this.counts() + (waiting.length ? '\n\n' + waiting.join('\n') : ''),
            color: this.config.colour
        };
        // Leave Queue and the pings in a row of their own, then a row of sizes for each channel, named when there's more than one
        const channels = this.channels(), rows = [], top = new ActionRowBuilder();
        const button = (id, label, style, icon) => {
            const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style), emoji = global.emoji.get(icon);
            return emoji ? b.setEmoji(emoji) : b;
        };
        if (channels.length) top.addComponents(button('matchmaking 0 leave', 'Leave Queue', ButtonStyle.Danger));
        if (this.config.role) {
            top.addComponents(
                button('matchmaking 0 notify', 'Get @Matchmaking Pings', ButtonStyle.Secondary, 'alert'),
                button('matchmaking 0 stop', 'Stop @Matchmaking Pings', ButtonStyle.Secondary, 'warning'));
        }
        if (top.components.length) rows.push(top);
        for (const c of channels.slice(0, 4)) {
            rows.push(new ActionRowBuilder().addComponents(...thresholds.map(t => new ButtonBuilder()
                .setCustomId(`matchmaking ${c.name}:${t} join`).setLabel(channels.length > 1 ? `${c.name} ${t}+` : `${t}+`).setStyle(ButtonStyle.Primary))));
        }
        return { embeds: [embed], components: rows };
    },
    queuechanged() {
        if (this.queueediting) return;
        this.queueediting = true;
        this.later(this.config.queueedit, () => {
            this.queueediting = false;
            this.editqueue().catch(err => global.log.error(`Matchmaking: ${err.stack || err}`));
        });
    },
    async editqueue() {
        if (!this.thread || !this.data.queue) return;
        const counts = this.counts() + this.channels().map(c => c.name).join() + this.waitinglines().join();
        if (counts === this.lastqueue) return;
        const msg = await this.thread.messages.fetch(this.data.queue).catch(() => null);
        if (!msg) {
            await this.recreate();
            return;
        }
        await msg.edit(this.queuemessage());
        this.lastqueue = counts;
    },

    // The find players channel hears who joined the queue, found as handles new since the last queue event, which says nobody
    // joined for the first one after connecting; a change of match size says nothing
    joined() {
        const entries = this.queue && Array.isArray(this.queue.entries) ? this.queue.entries : [];
        const known = this.known;
        this.known = new Set(entries.map(e => e.handle));
        if (!known) return;
        const channels = this.channels().length > 1;
        for (const e of entries) {
            if (known.has(e.handle)) continue;
            global.post.findplayers(`${this.who(e)} joined the Matchmaking Queue for a ${channels && e.channel ? `${e.channel} ` : ''}${e.threshold}+ match ([join the queue](<${this.threadurl()}>))`);
        }
    },
    // and who left it, themselves, by running out of time or by not joining the match they were sent to; one who arrived
    // or was satisfied has a server's join line instead, and the rest are housekeeping
    left(msg) {
        const why = { left: '', expired: ' (timed out)', popped: ' (didn\'t join their match)' };
        if (!(msg.reason in why) || !msg.handle) return;
        const e = this.queue && Array.isArray(this.queue.entries) ? this.queue.entries.find(x => x.handle === msg.handle) : null;
        if (this.known) this.known.delete(msg.handle);
        global.post.findplayers(`${this.who(e || { handle: msg.handle })} left the Matchmaking Queue${why[msg.reason]}`);
    },
    threadurl() {
        return `https://discord.com/channels/${this.bot.config.guildId}/${this.data.thread}`;
    },
    // Someone in the queue as the game shows them: their Privilege's icon, then display name and handle, or the handle alone
    who(e) {
        const name = this.plain(e.displayname || '');
        const icon = global.emoji.get(global.emoji.privilege(e.privilege)) || (e.privilege ? `(${e.privilege})` : '');
        const who = name ? `**${escapeMarkdown(name)}** (${escapeMarkdown(e.handle)})` : `**${escapeMarkdown(e.handle)}**`;
        return `${icon ? `${icon} ` : ''}${who}`;
    },

    // Get @Matchmaking Pings and Stop @Matchmaking Pings give and take the role members mention when they want more players;
    // one without a linked account hears how to get one, as they can't queue when the ping comes
    async notify(member, on) {
        const role = this.config.role;
        if (!role) return '@Matchmaking pings aren\'t set up here.';
        if (member.roles.cache.has(role) === on) return on ? 'You already get @Matchmaking pings.' : 'You don\'t get @Matchmaking pings.';
        try {
            if (on) await member.roles.add(role, 'Matchmaking: Get @Matchmaking Pings');
            else await member.roles.remove(role, 'Matchmaking: Stop @Matchmaking Pings');
        }
        catch (err) {
            global.log.warn(`Matchmaking: couldn't ${on ? 'give' : 'take'} the role ${on ? 'to' : 'from'} ${member.user.tag}: ${err.message}`);
            return 'Couldn\'t change that right now, so a moderator has been told.';
        }
        if (!on) return 'You won\'t get @Matchmaking pings any more.';
        const linked = global.accounts && global.accounts.master ? await global.accounts.lookup(member.id) : null;
        return `You'll get a ping when someone mentions @Matchmaking for more players, usually in <#${this.bot.config.channels.findplayers}>.` + (linked ? '' : `\n${this.accounthelp()}`);
    },

    // A place about to run out gets a mention with a button for more time, deleted once it's done its job, for every account
    // linked to a member, wherever it queued from
    async reminders() {
        const q = this.queue;
        if (!this.thread || !q || !Array.isArray(q.entries)) return;
        const now = Date.now() / 1000;
        for (const e of q.entries) {
            if (!e.discord || !e.expires || e.popped) continue;
            const left = e.expires - now;
            if (left > this.config.remind / 1000) {
                if (this.data.reminders[e.discord]) await this.unremind(e.discord);
                continue;
            }
            if (this.data.reminders[e.discord] || left <= 0) continue;
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`matchmaking ${e.discord} renew`).setLabel('+30 minutes').setStyle(ButtonStyle.Primary));
            const sent = await this.thread.send({ content: `<@${e.discord}> your place in the Matchmaking Queue ends <t:${Math.round(e.expires)}:R>. Want more time?`, components: [row], allowedMentions: { users: [e.discord] } });
            this.data.reminders[e.discord] = sent.id;
            this.save();
        }
    },
    async unremind(discord) {
        const id = this.data.reminders[discord];
        if (!id) return;
        delete this.data.reminders[discord];
        this.save();
        if (this.thread) await this.thread.messages.delete(id).catch(() => null);
    },

    // The members a pop sent, every account in it linked to one, are mentioned in the server's own thread, which the bridge
    // makes and welcomes first if it has none, each with a join link; the master sees them arrive by their account
    // The find players channel hears every pop, naming those it sent without mentioning them, with the size that was met
    async pop(msg) {
        const entries = Array.isArray(msg.entries) ? msg.entries : [];
        const server = { host: msg.host, port: msg.port };
        const bridged = global.bridge && global.bridge.servers && global.bridge.servers.get(`${msg.host}:${msg.port}`);
        if (entries.length) {
            const size = Math.max(...entries.map(e => Number(e.threshold) || 0));
            const listed = this.servers.get(`${msg.host}:${msg.port}`);
            const where = bridged && bridged.info ? global.bridge.threadlink(bridged)
                : `**${escapeMarkdown(this.plain(listed && listed.description) || `${msg.host}:${msg.port}`)}**`;
            global.post.findplayers(`A ${size}+ match is ready on ${where} ([join](<${this.bounce(server)}>)): ${entries.map(e => this.who(e)).join(', ')}`);
        }
        const members = entries.filter(e => e.discord);
        if (!members.length) return;
        for (const m of members) await this.unremind(m.discord);
        const content = `**Your match is ready here.** ${members.map(m => `<@${m.discord}>`).join(', ')} ([join](<${this.bounce(server)}>))`;
        if (bridged && global.bridge.forum) {
            global.bridge.post({ server: bridged, kind: 'mention', create: true, content, mentions: members.map(m => m.discord) });
            return;
        }
        // without the bridge there's no server thread to go to, so the Matchmaking thread says where
        if (this.thread) await this.thread.send({ content: `${content} on ${this.serverlines(this.servers.get(`${msg.host}:${msg.port}`) || server)}`, allowedMentions: { users: members.map(m => m.discord) } });
    },

    // What the buttons ask of the master, answered once it has taken it or said why not
    ask(discord, msg) {
        return new Promise(resolve => {
            if (!this.token) return resolve({ error: 'the queue isn\'t taking places from Discord right now' });
            const old = this.waiting.get(discord);
            if (old) old({ error: 'superseded' });
            this.waiting.set(discord, resolve);
            if (!this.send(Object.assign({ discord }, msg))) {
                this.waiting.delete(discord);
                return resolve({ error: 'the master server isn\'t reachable right now' });
            }
            this.later(this.config.answerwait, () => {
                if (this.waiting.get(discord) !== resolve) return;
                this.waiting.delete(discord);
                resolve({ error: 'the master server didn\'t answer' });
            });
        });
    },
    async join(discord, channel, threshold) {
        const answer = await this.ask(discord, { queue: 'join', channel, threshold });
        if (answer.error === 'no account') return this.accounthelp();
        if (answer.error) return `Couldn't join the Matchmaking Queue: ${answer.error}.`;
        const c = this.channels().find(x => x.name === answer.channel);
        return `You're in the Matchmaking Queue as ${answer.handle} for a ${answer.threshold}+ match${c ? ` with ${this.channelname(c)} players` : ''} until <t:${Math.round(answer.expires)}:t>. You'll be mentioned in the server's thread when it's ready.`;
    },
    async leave(discord) {
        const answer = await this.ask(discord, { queue: 'leave' });
        if (answer.error === 'no account') return this.accounthelp();
        if (answer.error && answer.error !== 'superseded') return `Couldn't leave the Matchmaking Queue: ${answer.error}.`;
        await this.unremind(discord);
        return 'You\'ve left the Matchmaking Queue, wherever you joined it from.';
    },
    async renew(discord) {
        const answer = await this.ask(discord, { queue: 'renew' });
        if (answer.error === 'no account') return this.accounthelp();
        if (answer.error) return `Couldn't add more time: ${answer.error}.`;
        await this.unremind(discord);
        return `Your place in the Matchmaking Queue now lasts until <t:${Math.round(answer.expires)}:t>.`;
    },
    // Where a member stands, from the entries the master shows the bot, which name the member linked to each account
    status(discord) {
        const e = this.queue && Array.isArray(this.queue.entries) ? this.queue.entries.find(x => x.discord === discord) : null;
        if (!e) return `You're not in the Matchmaking Queue.\n${this.counts()}`;
        if (e.popped) return 'Your match is ready: look for your mention in its server\'s thread.';
        if (e.held) return `You're in the Matchmaking Queue as ${e.handle} for a ${e.threshold}+ match, and already on ${e.held.host}:${e.held.port}.`;
        return `You're in the Matchmaking Queue as ${e.handle} for a ${e.threshold}+ ${e.channel || ''} match until <t:${Math.round(e.expires)}:t>.`;
    }
};
