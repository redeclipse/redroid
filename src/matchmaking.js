const fs = require('fs');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Events } = require('discord.js');

// The Matchmaking thread: a pinned post in the bridge's forum whose first message lists the servers and whose second is the
// master's Ready queue, which members join from its buttons; the master owns the queue, and this only shows it and passes on
// what members ask of it, signed in with the bridge's account so it may queue them by their Discord ID
// The current game's names, as the website's server browser has them; servers older than modesfrom just get their mode
const names = {
    modes: ['Demo', 'Editing', 'Deathmatch', 'Capture the Flag', 'Defend and Control', 'Bomber Ball', 'Speedrun'],
    mutators: ['Free for All', 'Coop', 'Instagib', 'Medieval', 'Kaboom', 'Duel', 'Survivor', 'Classic', 'Onslaught', 'Vampire', 'Resize', 'Hard', 'Arena', 'Dark'],
    gsp: { 2: ['Gladiator', 'Old School'], 3: ['Quick', 'Defend', 'Protect'], 4: ['Quick', 'King'], 5: ['Hold', 'Basket', 'Assault'], 6: ['Lapped', 'Endurance', 'Gauntlet'] },
    modesfrom: 278
};
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
    lastlist: '',
    lastqueue: '',
    lastping: 0,
    pinged: new Set(), // Thresholds already pinged for since the queue last emptied

    start(bot) {
        const auth = bot.config.auth || {};
        this.forumid = auth.relay || (bot.config.channels || {}).relay;
        this.config = bot.config.matchmaking;
        if (!auth.handle || !auth.privkey || !this.forumid || !this.config) {
            global.log.out('Matchmaking: auth.handle, auth.privkey, the bridge\'s forum channel and config.matchmaking are needed, not starting.');
            return false;
        }
        this.config = Object.assign({}, this.config, { role: (bot.config.roles || {}).matchmaking });
        this.bot = bot;
        this.master = (auth.master || 'https://play.redeclipse.net:28888').replace(/\/+$/, '');
        try {
            if (fs.existsSync(this.config.file)) this.data = Object.assign(this.data, JSON.parse(fs.readFileSync(this.config.file, 'utf-8')));
        }
        catch (e) {
            global.log.error(e);
        }
        bot.once(Events.ClientReady, () => this.ready().catch(err => global.log.error(`Matchmaking: ${err.stack || err}`)));
        bot.on(Events.ThreadUpdate, (before, after) => this.threadupdate(after).catch(err => global.log.error(`Matchmaking: ${err.stack || err}`)));
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
        let queuemsg = this.data.queue ? await this.thread.messages.fetch(this.data.queue).catch(() => null) : null;
        if (!queuemsg) {
            queuemsg = await this.thread.send(this.queuemessage());
            this.data.queue = queuemsg.id;
            this.save();
        }
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

    // Every refresh: the list, edited when it reads differently, and reminders for places about to run out
    async tick() {
        if (!this.thread) return;
        const embed = this.listembed(), text = JSON.stringify(embed);
        if (text !== this.lastlist) {
            const first = await this.thread.messages.fetch(this.data.list).catch(() => null);
            if (first) {
                await first.edit({ embeds: [embed] });
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
    bounce(server, ticket) {
        const link = `${this.master}/join/${encodeURIComponent(server.host)}/${server.port}`;
        return ticket ? `${link}?ticket=${ticket}` : link;
    },
    modename(st) {
        if (typeof st.gameversion === 'number' && st.gameversion < names.modesfrom) return names.modes[st.modeid] || `Mode ${st.modeid}`;
        const muts = [], gsp = names.gsp[st.modeid] || [], named = names.mutators.length;
        for (let i = 0; i < 31; i++) {
            if (!(st.mutators & (1 << i))) continue;
            const m = i < named ? names.mutators[i] : gsp[i - named];
            if (m) muts.push(m);
        }
        const mode = names.modes[st.modeid] || `Mode ${st.modeid}`;
        return muts.length ? `${mode}: ${muts.join(', ')}` : mode;
    },
    people(server) {
        return server.status && Array.isArray(server.status.players) ? server.status.players.length : 0;
    },
    // A server as one line: its name linked to its bounce link, what it's playing, how full it is and when the match ends,
    // which every reader's Discord counts down by itself
    serverline(server) {
        const name = this.escape(this.plain(server.description) || `${server.host}:${server.port}`);
        let line = `**[${name}](<${this.bounce(server)}>)**`;
        const st = server.status;
        if (!st) return line;
        const map = this.plain(st.maptitle || st.map);
        line += ` ${this.modename(st)} on ${this.escape(map)}, ${this.people(server)}/${st.maxplayers}`;
        if (typeof st.ends === 'number' && st.ends > 0) line += `, ends <t:${Math.round(st.ends)}:R>`;
        return line;
    },
    listembed() {
        const all = [...this.servers.values()];
        const busy = all.filter(s => this.people(s) > 0).sort((a, b) => this.people(b) - this.people(a) || b.priority - a.priority);
        const empty = all.filter(s => !this.people(s)).sort((a, b) => b.priority - a.priority);
        const lines = [...busy, ...empty.slice(0, this.config.emptyshown)].map(s => this.serverline(s));
        const more = empty.length - this.config.emptyshown;
        if (more > 0) lines.push(`and ${more} more empty ${more === 1 ? 'server' : 'servers'}`);
        if (!lines.length) lines.push(this.servers.size || this.live ? 'No servers are listed right now.' : 'Waiting for the server list.');
        let description = '';
        for (const line of lines) {
            if (description.length + line.length + 1 > 4000) break;
            description += (description ? '\n' : '') + line;
        }
        return { title: 'Servers', description, color: this.config.colour, footer: { text: `Click a server to join it. Checked every ${Math.round(this.config.refresh / 1000)} seconds.` } };
    },

    // The game's own wording, so the queue reads the same everywhere
    counts() {
        const q = this.queue;
        if (!q) return 'The queue isn\'t reachable right now.';
        let text = `${q.ready} waiting`;
        if (q.next && q.next.needed) text += `, ${q.next.needed} more needed for a ${q.next.threshold}+ match`;
        else if (!q.ready) text = 'Nobody is waiting yet';
        return text;
    },
    queuemessage() {
        const embed = {
            title: 'Ready queue',
            description: 'Pick a match size: everyone waiting is sent to a server together. You\'ll be mentioned in that server\'s thread when it\'s time to join, and your place lasts 60 minutes.\n\n' + this.counts(),
            color: this.config.colour
        };
        const row = new ActionRowBuilder().addComponents(
            ...thresholds.map(t => new ButtonBuilder().setCustomId(`matchmaking ${t} join`).setLabel(`${t}+`).setStyle(ButtonStyle.Primary)),
            new ButtonBuilder().setCustomId('matchmaking 0 leave').setLabel('Leave').setStyle(ButtonStyle.Secondary)
        );
        return { embeds: [embed], components: [row] };
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
        const counts = this.counts();
        if (counts === this.lastqueue) return;
        const msg = await this.thread.messages.fetch(this.data.queue).catch(() => null);
        if (!msg) {
            await this.recreate();
            return;
        }
        await msg.edit(this.queuemessage());
        this.lastqueue = counts;
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
        if (!this.config.role || !q.next || q.next.needed !== 1 || this.pinged.has(q.next.threshold) || Date.now() - this.lastping < this.config.pinggap) return;
        this.pinged.add(q.next.threshold);
        this.lastping = Date.now();
        const sent = await this.thread.send({ content: `<@&${this.config.role}> one more player would make a ${q.next.threshold}+ match. Join the queue above.`, allowedMentions: { roles: [this.config.role] } });
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
        if (this.thread) await this.thread.send({ content: `${content} on ${this.serverline(this.servers.get(`${msg.host}:${msg.port}`) || server)}`, allowedMentions: { users: members.map(m => m.discord) } });
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
    async join(discord, threshold) {
        const answer = await this.ask(discord, { queue: 'join', threshold });
        if (answer.error) return `Couldn't join the Ready queue: ${answer.error}.`;
        return `You're in the Ready queue for a ${answer.threshold}+ match until <t:${Math.round(answer.expires)}:t>. You'll be mentioned in the server's thread when it's ready.`;
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
        if (!e) return `You're not in the Ready queue. ${this.counts()}.`;
        if (e.popped) return 'Your match is ready: look for your mention in its server\'s thread.';
        if (e.held) return `You're in the Ready queue for a ${e.threshold}+ match, and already on ${e.held.host}:${e.held.port}.`;
        const until = e.expires ? ` until <t:${Math.round(e.expires)}:t>` : '';
        return `You're in the Ready queue for a ${e.threshold}+ match${until}. ${this.counts()}.`;
    }
};
