const tools = require('./tools'); // global.tools, which starts after this does
const { Events, escapeMarkdown } = require('discord.js');

// The master's Admin notices, such as Master Shield's bans and changes to the global lists and accounts, posted to the admin
// notices channel: the bot's account watches the master's live list for them, and asks for the ones it missed after a restart
// or a dropped connection by the last id it posted
// How the kinds are named in the channel
const KINDS = { shield: 'Master Shield', control: 'Global lists', account: 'Accounts', serveraccount: 'Server accounts' };

module.exports = {
    name: 'adminnotices',
    config: null, // config.adminnotices
    bot: null,
    live: null,
    stopped: false,
    timers: new Set(),
    data: { last: 0 },

    start(bot) {
        const auth = bot.config.auth || {};
        this.config = bot.config.adminnotices;
        if (!auth.master || !(bot.config.channels || {}).notices || !this.config) {
            global.log.out('Admin notices: auth.master, channels.notices and config.adminnotices are needed, not starting.');
            return false;
        }
        this.bot = bot;
        this.master = auth.master.replace(/\/+$/, '');
        const parsed = tools.readjson(this.config.file);
        if (parsed) this.data = Object.assign(this.data, parsed);
        bot.once(Events.ClientReady, () => this.connect().catch(err => global.log.error(`Admin notices: ${err.stack || err}`)));
        return true;
    },
    shutdown() {
        this.stopped = true;
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
            fun();
        }, ms);
        this.timers.add(timer);
    },

    async connect() {
        if (this.stopped) return;
        const res = global.accounts ? await global.accounts.mastersession() : { status: 0, error: 'accounts aren\'t set up' };
        if (res.status !== 200 || !res.json || !res.json.token) {
            global.log.warn(`Admin notices: couldn't sign in to the master, trying again: ${res.error || res.status}`);
            this.later(this.config.retry, () => this.connect().catch(err => global.log.error(`Admin notices: ${err.stack || err}`)));
            return;
        }
        let url = `${this.master.replace(/^http/, 'ws')}/api/v1/live?token=${encodeURIComponent(res.json.token)}`;
        if (this.data.last) url += `&since=${this.data.last}`;
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
            if (msg.event === 'notice') this.notice(msg);
        });
        ws.addEventListener('close', () => {
            if (this.live !== ws || this.stopped) return;
            this.live = null;
            this.later(this.config.retry, () => this.connect().catch(err => global.log.error(`Admin notices: ${err.stack || err}`)));
        });
        ws.addEventListener('error', () => ws.close());
    },

    notice(msg) {
        const id = Number(msg.id);
        if (!Number.isFinite(id) || id <= this.data.last || typeof msg.text !== 'string') return;
        const kind = KINDS[msg.kind] || 'Master';
        // one that waited for the bot says when it happened, as its post doesn't
        const when = Number(msg.time) && Date.now() / 1000 - msg.time > this.config.late / 1000 ? ` <t:${Math.floor(msg.time)}:f>` : '';
        // while it can't be posted, as when the bot is offline on Discord, the socket is closed and opened again later
        // asking for those after the last one posted, so none are lost
        if (!global.post.adminnotice(`**${kind}**${when}: ${escapeMarkdown(msg.text)}`)) {
            if (this.live) this.live.close();
            return;
        }
        this.data.last = id;
        this.save();
    },
};
