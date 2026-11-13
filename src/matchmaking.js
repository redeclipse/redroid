const tools = require('./tools'); // global.tools, which starts after this does
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Events, escapeMarkdown } = require('discord.js');

// The Matchmaking thread: a pinned post in the bridge's forum whose first message lists the servers and whose second is the
// master's Ready queue, which members join from its buttons; the master owns the queue, and this only shows it and passes on
// what members ask of it, signed in with the bridge's account so it may queue them by their Discord ID
// Mode names by the game protocol they apply from, newest first, as the website's server browser has them
const modes = [
    { from: 278, names: ['Demo', 'Editing', 'Deathmatch', 'Capture the Flag', 'Defend and Control', 'Bomber Ball', 'Speedrun'] },
    { from: 226, names: ['Demo', 'Editing', 'Deathmatch', 'Capture the Flag', 'Defend and Control', 'Bomber Ball', 'Race'] },
    { from: 220, names: ['Demo', 'Editing', 'Deathmatch', 'Capture the Flag', 'Defend the Flag', 'Bomber Ball', 'Time Trial', 'Gauntlet'] },
    { from: 217, names: ['Demo', 'Editing', 'Deathmatch', 'Capture the Flag', 'Defend the Flag', 'Bomber Ball', 'Time Trial'] },
    { from: 0, names: ['Demo', 'Editing', 'Campaign', 'Deathmatch', 'Capture the Flag', 'Defend the Flag', 'Bomber Ball', 'Time Trial'] }
];
// The Thresholds the master takes
const thresholds = [2, 4, 6, 8];

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
    data: { thread: null, list: null, queue: null, pings: [], reminders: {} },
    servers: new Map(), // host:port -> the master's listing
    queue: null, // the master's last queue event's queue, with its entries
    waiting: new Map(), // Discord ID -> the button waiting to hear the master's answer
    last: '', // what the opening message last said, so it's only edited when that changes
    lastping: 0,
    pinged: new Set(), // Thresholds already pinged for since the queue last emptied

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

    // The thread, made again if a moderator deleted it; the server list and the queue are both in its opening message, which
    // stays first in the thread and is what the forum shows of it, and a queue message of its own from before goes
    async ensure() {
        if (this.data.thread) this.thread = await this.forum.threads.fetch(this.data.thread).catch(() => null);
        if (!this.thread) {
            this.thread = await this.forum.threads.create({
                name: this.config.title,
                autoArchiveDuration: 10080,
                message: this.opening()
            });
            this.data.thread = this.thread.id;
            this.data.list = this.thread.id; // a forum post's first message has the thread's id
            this.save();
            await this.thread.pin().catch(err => global.log.warn(`Matchmaking: couldn't pin the thread: ${err.message}`));
        }
        if (this.thread.archived) await this.thread.setArchived(false);
        if (this.data.queue && this.data.queue !== this.data.list) {
            await this.thread.messages.delete(this.data.queue).catch(() => null);
            this.data.queue = null;
            this.save();
        }
        this.last = '';
        await this.render();
    },
    // The thread only holds the queue, so anything else said there goes, with a note that deletes itself saying where to talk,
    // as even someone who may post there needn't know it isn't for talking
    async message(message) {
        if (!this.thread || message.channelId !== this.thread.id || message.author.id === this.bot.user.id || message.system) return;
        await message.delete().catch(err => global.log.warn(`Matchmaking: couldn't delete a message in the thread: ${err.message}`));
        const note = await this.thread.send({ content: `<@${message.author.id}> this thread only holds the queue, so your message was removed. Talk about a match in its server's thread.`, allowedMentions: { users: [message.author.id] } }).catch(() => null);
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
        const auth = this.bot.config.auth;
        const post = async body => {
            const res = await fetch(`${this.master}/api/v1/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
            return { status: res.status, json: await res.json().catch(() => null) };
        };
        try {
            const chal = await post({ name: auth.handle });
            if (chal.status !== 200 || !chal.json || !chal.json.challenge) throw new Error(`challenge refused (${chal.status})`);
            const answer = global.bridge.answer(auth.privkey, chal.json.challenge);
            if (!answer) throw new Error('couldn\'t answer the challenge');
            const done = await post({ id: chal.json.id, answer });
            if (done.status !== 200 || !done.json || !done.json.token) throw new Error(`answer refused (${done.status})`);
            global.log.out(`Matchmaking: signed in to the master as ${done.json.name} (${done.json.privilege})`);
            return done.json.token;
        }
        catch (e) {
            global.log.warn(`Matchmaking: couldn't sign in to the master, showing the queue without taking places: ${e.message}`);
            return null;
        }
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
                await this.pings();
                break;
            case 'queued': case 'unqueued': {
                const waiter = msg.discord && this.waiting.get(msg.discord);
                if (waiter) {
                    this.waiting.delete(msg.discord);
                    waiter(msg);
                }
                if (msg.event === 'unqueued' && msg.discord) await this.unremind(msg.discord);
                break;
            }
            case 'pop':
                await this.pop(msg);
                break;
        }
    },

    // Every refresh: the opening message, edited when it reads differently, and reminders for places about to run out
    async tick() {
        if (!this.thread) return;
        await this.render();
        await this.reminders();
    },
    // The server list and the queue, with the queue's buttons
    opening() {
        const queue = this.queuemessage();
        return { embeds: [this.listembed(), ...queue.embeds], components: queue.components };
    },
    async render() {
        if (!this.thread || this.rendering) return;
        const msg = this.opening(), text = JSON.stringify([msg.embeds, msg.components]);
        if (text === this.last) return;
        this.rendering = true;
        try {
            const first = await this.thread.messages.fetch(this.data.list).catch(() => null);
            if (first) {
                await first.edit(msg);
                this.last = text;
            }
            else {
                await this.recreate();
            }
        }
        finally {
            this.rendering = false;
        }
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
    bounce(server, ticket) {
        const link = `${this.master}/join/${encodeURIComponent(server.host)}/${server.port}`;
        return ticket ? `${link}?ticket=${ticket}` : link;
    },
    modename(st) {
        const v = typeof st.gameversion === 'number' ? st.gameversion : Infinity;
        return modes.find(m => v >= m.from).names[st.modeid] || null;
    },
    people(server) {
        return server.status && Array.isArray(server.status.players) ? server.status.players.length : 0;
    },
    // A server as its name, linked to its bounce link, over what it's playing and how full it is; a name's brackets go, as
    // Discord shows a link's escaped brackets as they are
    serverlines(server) {
        const name = escapeMarkdown(this.plain(server.description) || `${server.host}:${server.port}`).replace(/[[\]]/g, '');
        const st = server.status;
        const details = [];
        if (st) {
            const mode = this.modename(st);
            if (mode) details.push(mode);
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
    queuemessage() {
        const embed = {
            title: 'Matchmaking Queue',
            description: 'Pick a match size to enter the queue for matchmaking. You\'ll be mentioned in that server\'s thread when it\'s time to join, and your place lasts 60 minutes.\n\n' + this.counts(),
            color: this.config.colour
        };
        // a row of sizes for each channel, named when there's more than one, and Leave on its own
        const channels = this.channels(), rows = [];
        for (const c of channels) {
            rows.push(new ActionRowBuilder().addComponents(...thresholds.map(t => new ButtonBuilder()
                .setCustomId(`matchmaking ${c.name}:${t} join`).setLabel(channels.length > 1 ? `${c.name} ${t}+` : `${t}+`).setStyle(ButtonStyle.Primary))));
        }
        if (rows.length) rows[rows.length - 1].addComponents(new ButtonBuilder().setCustomId('matchmaking 0 leave').setLabel('Leave').setStyle(ButtonStyle.Secondary));
        return { embeds: [embed], components: rows };
    },
    queuechanged() {
        if (this.queueediting) return;
        this.queueediting = true;
        this.later(this.config.queueedit, () => {
            this.queueediting = false;
            this.render().catch(err => global.log.error(`Matchmaking: ${err.stack || err}`));
        });
    },

    // @Matchmaking hears when one more would make a match, once for each Threshold until the queue empties, and those
    // pings go once nobody is waiting
    async pings() {
        const q = this.queue;
        if (!this.thread || !q) return;
        if (!q.ready) {
            if (!this.data.pings.length) return;
            for (const id of this.data.pings.splice(0)) await this.thread.messages.delete(id).catch(() => null);
            this.pinged.clear();
            this.save();
            return;
        }
        const c = this.channels().find(x => x.next && x.next.needed === 1 && !this.pinged.has(`${x.name}:${x.next.threshold}`));
        if (!this.config.role || !c || Date.now() - this.lastping < this.config.pinggap) return;
        this.pinged.add(`${c.name}:${c.next.threshold}`);
        this.lastping = Date.now();
        const sent = await this.thread.send({ content: `<@&${this.config.role}> one more ${this.channelname(c)} player would make a ${c.next.threshold}+ match. Join the queue above.`, allowedMentions: { roles: [this.config.role] } });
        this.data.pings.push(sent.id);
        this.save();
    },

    // A member's place about to run out gets a mention with a button for more time, deleted once it's done its job
    async reminders() {
        const q = this.queue;
        if (!this.thread || !q || !Array.isArray(q.entries)) return;
        const now = Date.now() / 1000;
        for (const e of q.entries) {
            if (!e.discord || !e.expires || !(e.sources || []).includes('discord') || e.popped) continue;
            const left = e.expires - now;
            if (left > this.config.remind / 1000) {
                if (this.data.reminders[e.discord]) await this.unremind(e.discord);
                continue;
            }
            if (this.data.reminders[e.discord] || left <= 0) continue;
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`matchmaking ${e.discord} renew`).setLabel('+30 minutes').setStyle(ButtonStyle.Primary));
            const sent = await this.thread.send({ content: `<@${e.discord}> your place in the Ready queue ends <t:${Math.round(e.expires)}:R>. Want more time?`, components: [row], allowedMentions: { users: [e.discord] } });
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

    // The members a pop sent are mentioned in the server's own thread, which the bridge makes and welcomes first if it has
    // none, each with a join link carrying their Ticket so the master sees them arrive
    async pop(msg) {
        const members = (msg.entries || []).filter(e => e.discord && e.ticket && (e.sources || []).includes('discord'));
        if (!members.length) return;
        const server = { host: msg.host, port: msg.port };
        for (const m of members) await this.unremind(m.discord);
        const links = members.map(m => `<@${m.discord}> ([join](<${this.bounce(server, m.ticket)}>))`).join(', ');
        const content = `**Your match is ready here.** ${links}`;
        const bridged = global.bridge && global.bridge.servers && global.bridge.servers.get(`${msg.host}:${msg.port}`);
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
        if (answer.error) return `Couldn't join the Ready queue: ${answer.error}.`;
        const c = this.channels().find(x => x.name === answer.channel);
        return `You're in the Ready queue for a ${answer.threshold}+ match${c ? ` with ${this.channelname(c)} players` : ''} until <t:${Math.round(answer.expires)}:t>. You'll be mentioned in the server's thread when it's ready.`;
    },
    async leave(discord) {
        const answer = await this.ask(discord, { queue: 'leave' });
        if (answer.error && answer.error !== 'superseded') return `Couldn't leave the Ready queue: ${answer.error}.`;
        await this.unremind(discord);
        return 'You\'ve left the Ready queue.';
    },
    async renew(discord) {
        const answer = await this.ask(discord, { queue: 'renew' });
        if (answer.error) return `Couldn't add more time: ${answer.error}.`;
        await this.unremind(discord);
        return `Your place in the Ready queue now lasts until <t:${Math.round(answer.expires)}:t>.`;
    },
    // Where a member stands, from the entries the master shows the bot
    status(discord) {
        const e = this.queue && Array.isArray(this.queue.entries) ? this.queue.entries.find(x => x.discord === discord) : null;
        if (!e) return `You're not in the Ready queue.\n${this.counts()}`;
        if (e.popped) return 'Your match is ready: look for your mention in its server\'s thread.';
        if (e.held) return `You're in the Ready queue for a ${e.threshold}+ match, and already on ${e.held.host}:${e.held.port}.`;
        const until = e.expires ? ` until <t:${Math.round(e.expires)}:t>` : '';
        return `You're in the Ready queue for a ${e.threshold}+ ${e.channel || ''} match${until}.`;
    }
};
