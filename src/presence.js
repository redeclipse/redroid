const { ActivityType, Events } = require('discord.js');

// The bot's status says how many are playing, from the master's server list
module.exports = {
    name: 'presence',
    config: {
        master: 'https://play.redeclipse.net:28888',
        interval: 60000, // ms between looks at the master's list
        timeout: 10000 // ms before a look is given up
    },
    bot: null,
    timer: null,
    etag: null,
    text: null,

    start(bot) {
        this.bot = bot;
        this.master = ((bot.config.auth || {}).master || this.config.master).replace(/\/+$/, '');
        bot.once(Events.ClientReady, () => {
            this.poll();
            this.timer = setInterval(() => this.poll(), this.config.interval);
        });
        // A fresh session after a lost connection starts with no status, so it is set again
        bot.on(Events.ShardReady, () => this.apply());
        return true;
    },
    shutdown() {
        clearInterval(this.timer);
        this.timer = null;
    },

    async poll() {
        try {
            const headers = this.etag ? { 'If-None-Match': this.etag } : {};
            const res = await fetch(`${this.master}/api/v1/servers`, { headers, signal: AbortSignal.timeout(this.config.timeout) });
            if (res.status === 304) return;
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const list = await res.json();
            const servers = Array.isArray(list.servers) ? list.servers : [];
            // every human player, spectators included, as the list leaves bots out
            const players = servers.reduce((n, s) => n + (s.status && Array.isArray(s.status.players) ? s.status.players.length : 0), 0);
            this.etag = res.headers.get('etag');
            const text = `${players} ${players === 1 ? 'player' : 'players'} on ${servers.length} ${servers.length === 1 ? 'server' : 'servers'}`;
            if (text === this.text) return;
            this.text = text;
            this.apply();
        }
        catch (e) {
            // the last count stays up until the master answers again
            global.log.out(`Presence: the master's server list could not be read: ${e.name === 'TimeoutError' ? 'it took too long to answer' : e.message}`);
        }
    },
    apply() {
        if (!this.text || !this.bot || !this.bot.user) return;
        this.bot.user.setPresence({ status: 'online', activities: [{ type: ActivityType.Watching, name: this.text }] });
    }
};
