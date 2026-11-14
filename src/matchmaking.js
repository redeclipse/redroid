const tools = require('./tools'); // global.tools, which starts after this does
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Events, escapeMarkdown } = require('discord.js');

// The Matchmaking thread: a pinned post in the bridge's forum whose first message lists the servers and whose second is the
// master's Matchmaking Queue, which members join from its buttons through the Red Eclipse account they linked; the master owns
// the queue, and this only shows it and passes on what members ask of it, signed in with the bridge's account so it may queue
// them by their Discord ID
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
    data: { thread: null, list: null, queue: null, pings: [], lastping: 0, reminders: {} }, // pings: { id, key } with key channel:Threshold
    servers: new Map(), // host:port -> the master's listing
    queue: null, // the master's last queue event's queue, with its entries
    waiting: new Map(), // Discord ID -> the button waiting to hear the master's answer
    lastlist: '',
    lastqueue: '',
    pinged: new Set(), // Thresholds already pinged for since the queue last emptied
    emoji: {}, // Privilege -> the guild's emoji for it, from config.matchmaking.emoji

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
        // pings kept as bare ids are from before they had keys, so the next check takes them down
        this.data.pings = this.data.pings.map(p => typeof p === 'string' ? { id: p, key: '' } : p);
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
        await this.findemoji();
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
        this.lastlist = '';
        this.lastqueue = '';
        await this.tick();
        await this.editqueue();
    },
    // Each Privilege's icon, as the guild's own emoji named in config.matchmaking.emoji; one that's missing is written in words
    async findemoji() {
        const emojis = await this.forum.guild.emojis.fetch().catch(() => null);
        this.emoji = {};
        for (const [priv, name] of Object.entries(this.config.emoji)) {
            const found = emojis && emojis.find(e => e.name === name);
            if (found) this.emoji[priv] = found.toString();
            else global.log.warn(`Matchmaking: no :${name}: emoji for ${priv}, so it's written in words.`);
        }
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
    // Who's waiting, as the game shows them: their Privilege's icon, display name or handle, then the handle, match size and
    // where they are; as many as fit, then how many more
    waitinglines() {
        const entries = this.queue && Array.isArray(this.queue.entries) ? this.queue.entries : [];
        const channels = this.channels().length > 1;
        const lines = [];
        let size = 0, i = 0;
        for (; i < entries.length; i++) {
            const e = entries[i], name = this.plain(e.displayname || '');
            const icon = this.emoji[e.privilege] || (['none', 'player'].includes(e.privilege) ? '' : `(${e.privilege})`);
            const who = name ? `**${escapeMarkdown(name)}** (${escapeMarkdown(e.handle)})` : `**${escapeMarkdown(e.handle)}**`;
            const where = e.state === 'held' ? ', on a server' : e.state === 'travelling' ? ', on the way' : '';
            const line = `${icon ? `${icon} ` : ''}${who} ${channels ? `${e.channel} ` : ''}${e.threshold}+${where}`;
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
                (this.config.role ? ' Notify me mentions you here when one more player would make a match, and Stop ends that.' : '') + '\n\n' + this.counts() + (waiting.length ? '\n\n' + waiting.join('\n') : ''),
            color: this.config.colour
        };
        // a row of sizes for each channel, named when there's more than one, then Leave and the pings in a row of their own
        const channels = this.channels(), rows = [];
        for (const c of channels.slice(0, 4)) {
            rows.push(new ActionRowBuilder().addComponents(...thresholds.map(t => new ButtonBuilder()
                .setCustomId(`matchmaking ${c.name}:${t} join`).setLabel(channels.length > 1 ? `${c.name} ${t}+` : `${t}+`).setStyle(ButtonStyle.Primary))));
        }
        const last = new ActionRowBuilder();
        if (rows.length) last.addComponents(new ButtonBuilder().setCustomId('matchmaking 0 leave').setLabel('Leave').setStyle(ButtonStyle.Secondary));
        if (this.config.role) {
            last.addComponents(
                new ButtonBuilder().setCustomId('matchmaking 0 notify').setLabel('Notify me').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('matchmaking 0 stop').setLabel('Stop').setStyle(ButtonStyle.Secondary));
        }
        if (last.components.length) rows.push(last);
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

    // @Matchmaking hears when one more would make a match, once for each Threshold until the queue empties: as soon as
    // pinggapbig allows when pingbig or more are waiting in that channel, held ones included, and only after pinggap otherwise;
    // each ping goes as soon as it's no longer true
    async pings() {
        const q = this.queue;
        if (!this.thread || !q) return;
        const key = c => `${c.name}:${c.next.threshold}`;
        const near = this.channels().filter(c => c.next && c.next.needed === 1), live = new Set(near.map(key));
        const stale = this.data.pings.filter(p => !live.has(p.key));
        if (stale.length) {
            this.data.pings = this.data.pings.filter(p => live.has(p.key));
            this.save();
            for (const p of stale) await this.thread.messages.delete(p.id).catch(() => null);
        }
        if (!q.ready) {
            this.pinged.clear();
            return;
        }
        if (!this.config.role) return;
        const since = Date.now() - (this.data.lastping || 0);
        const big = c => (c.ready || 0) + (c.held || 0) >= this.config.pingbig;
        const c = near.find(x => !this.pinged.has(key(x)) && since >= (big(x) ? this.config.pinggapbig : this.config.pinggap));
        if (!c) return;
        this.pinged.add(key(c));
        this.data.lastping = Date.now();
        this.save();
        const sent = await this.thread.send({ content: `<@&${this.config.role}> one more ${this.channelname(c)} player would make a ${c.next.threshold}+ match. Join the queue above.`, allowedMentions: { roles: [this.config.role] } });
        this.data.pings.push({ id: sent.id, key: key(c) });
        this.save();
    },

    // Notify me and Stop give and take the role the pings mention; one without a linked account hears how to get one,
    // as they can't queue when the ping comes
    async notify(member, on) {
        const role = this.config.role;
        if (!role) return 'Match pings aren\'t set up here.';
        if (member.roles.cache.has(role) === on) return on ? 'You\'re already mentioned when one more would make a match.' : 'You aren\'t mentioned for matches.';
        try {
            if (on) await member.roles.add(role, 'Matchmaking: Notify me');
            else await member.roles.remove(role, 'Matchmaking: Stop');
        }
        catch (err) {
            global.log.warn(`Matchmaking: couldn't ${on ? 'give' : 'take'} the role ${on ? 'to' : 'from'} ${member.user.tag}: ${err.message}`);
            return 'Couldn\'t change that right now, so a moderator has been told.';
        }
        if (!on) return 'You won\'t be mentioned for matches any more.';
        const linked = global.accounts && global.accounts.master ? await global.accounts.lookup(member.id) : null;
        return 'You\'ll be mentioned here when one more player would make a match.' + (linked ? '' : `\n${this.accounthelp()}`);
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
    async pop(msg) {
        const members = (msg.entries || []).filter(e => e.discord);
        if (!members.length) return;
        const server = { host: msg.host, port: msg.port };
        for (const m of members) await this.unremind(m.discord);
        const content = `**Your match is ready here.** ${members.map(m => `<@${m.discord}>`).join(', ')} ([join](<${this.bounce(server)}>))`;
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
