const tools = require('./tools'); // global.tools, which starts after this does
const { Events, escapeMarkdown } = require('discord.js');

// The master's Admin notices, such as Master shield's bans, failed sign-ins, servers that couldn't be listed and changes to the
// global lists and accounts, posted to the admin notices channel: the bot's account watches the master's live list for them,
// and asks for the ones it missed after a restart or a dropped connection by the last id it posted
// How the kinds are named in the channel
const KINDS = {
    shield: 'Master shield',
    control: 'Global lists',
    account: 'Accounts',
    serveraccount: 'Server accounts',
    signin: 'Sign-ins',
    listing: 'Server listing',
    master: 'Master',
    queue: 'Matchmaking queue',
};
// How a notice's level is named in its header; info, and anything from a master too old to say, has none
const LEVELS = { warning: 'Warning', error: 'Error' };
// The icon each level's header starts with
const ICONS = { info: 'info', warning: 'warning', error: 'alert' };
// What Discord allows in an embed's description
const DISCORD_EMBEDSIZE = 4096;

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
        // the level is in the header as well as the colour, which not everyone can tell apart; the header starts the description
        // with its icon, as audit embeds' do, since Discord doesn't draw custom emoji in an embed's title
        const level = LEVELS[msg.level] ? msg.level : 'info';
        const kind = KINDS[msg.kind] || 'Master';
        const icon = global.emoji ? global.emoji.icons(ICONS[level]) : '';
        const header = `${icon}**${LEVELS[level] ? `${kind}: ${LEVELS[level]}` : kind}**`;
        const embed = {
            description: `${header}\n${escapeMarkdown(msg.text)}`.slice(0, DISCORD_EMBEDSIZE),
            color: this.config.colours[level],
        };
        // when it happened, which for one that waited for the bot isn't when it was posted
        if (Number(msg.time) > 0) embed.timestamp = new Date(msg.time * 1000).toISOString();
        // while it can't be posted, as when the bot is offline on Discord, the socket is closed and opened again later
        // asking for those after the last one posted, so none are lost
        if (!global.post.adminnotice(embed)) {
            if (this.live) this.live.close();
            return;
        }
        this.data.last = id;
        this.save();
    },
};
