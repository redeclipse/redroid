const { Events } = require('discord.js');

// Icon emoji: the guild's emoji that stand for the game's icons, each named after the game's icon file, such as flag, pistol or
// deathmatch, so uploading one is all it takes for the bot to use it; config.emoji names a guild emoji for an icon whose emoji
// is named otherwise. Where two share a name an animated one wins over a static one, then the oldest.
// Every icon the bot shows, so the log can say which have no emoji
const ICONS = [
    'none', 'player', 'supporter', 'moderator', 'administrator', 'developer', 'founder', 'localsupporter', 'localmoderator', 'localadministrator', 'bot',
    'teamalpha', 'teamomega', 'teamneutral', 'winner',
    'demo', 'editing', 'deathmatch', 'capture', 'defend', 'bomber', 'speedrun',
    'ffa', 'coop', 'instagib', 'medieval', 'kaboom', 'duel', 'survivor', 'classic', 'onslaught', 'vampire', 'resize', 'hard', 'arena', 'dark',
    'gladiator', 'oldschool', 'capturequick', 'capturedefend', 'captureprotect', 'defendquick', 'defendking',
    'bomberhold', 'bomberbasket', 'bomberassault', 'speedrunlapped', 'speedrunendurance', 'speedrungauntlet',
    'spectator', 'dead', 'warning', 'dominated', 'alert', 'chat', 'info', 'settings', 'question',
    'tick', 'cross', 'menu', 'voices', 'attack', 'corrode', 'burn', 'pistol', 'star'
];

module.exports = {
    ICONS,
    bot: null,
    names: {}, // config.emoji: icon -> the guild emoji's name, where it isn't the icon's own
    found: new Map(), // guild emoji name -> the emoji used for it
    missing: new Set(),
    dups: new Set(),

    start(bot) {
        this.bot = bot;
        this.names = bot.config.emoji || {};
        const ours = e => e.guild && e.guild.id === bot.config.guildId;
        const changed = () => this.build(false);
        bot.once(Events.ClientReady, () => this.ready().catch(err => global.log.error(`Emoji: ${err.stack || err}`)));
        bot.on(Events.GuildEmojiCreate, e => ours(e) && changed());
        bot.on(Events.GuildEmojiDelete, e => ours(e) && changed());
        bot.on(Events.GuildEmojiUpdate, (o, n) => ours(n) && changed());
        return false;
    },
    async ready() {
        const guild = await this.bot.guilds.fetch(this.bot.config.guildId).catch(() => null);
        if (!guild) {
            global.log.warn('Emoji: the guild isn\'t reachable, so no icons are shown.');
            return;
        }
        await guild.emojis.fetch();
        this.build(true);
    },
    // From the guild's emoji as discord.js has them, which its events keep current; the log hears of every missing icon and
    // duplicate name at startup, and after that only of those a change made
    build(first) {
        const guild = this.bot.guilds.cache.get(this.bot.config.guildId);
        if (!guild) return;
        const older = (a, b) => a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        const groups = new Map();
        for (const e of guild.emojis.cache.values()) {
            if (!e.name) continue;
            if (!groups.has(e.name)) groups.set(e.name, []);
            groups.get(e.name).push(e);
        }
        const found = new Map(), dups = new Set();
        for (const [name, list] of groups) {
            list.sort((a, b) => (b.animated ? 1 : 0) - (a.animated ? 1 : 0) || older(a, b));
            found.set(name, list[0]);
            if (list.filter(e => e.animated === list[0].animated).length > 1) dups.add(name);
        }
        this.found = found;
        const wanted = [...new Set([...ICONS, ...this.extra()])];
        const missing = new Set(wanted.filter(icon => !this.emoji(icon)));
        const newmissing = [...missing].filter(n => first || !this.missing.has(n)), newdups = [...dups].filter(n => first || !this.dups.has(n));
        this.missing = missing;
        this.dups = dups;
        if (newmissing.length) global.log.warn(`Emoji: no emoji for ${newmissing.map(n => `:${this.name(n)}:`).join(' ')}, so ${newmissing.length === 1 ? 'that icon isn\'t' : 'those icons aren\'t'} shown.`);
        if (newdups.length) global.log.warn(`Emoji: more than one emoji is named ${newdups.map(n => `:${n}:`).join(' ')}, so the oldest is used.`);
    },
    // Icons named in other settings, such as the reaction on notices
    extra() {
        const react = ((this.bot && this.bot.config.notices) || {}).react;
        return react ? [react] : [];
    },
    name(icon) {
        return Object.prototype.hasOwnProperty.call(this.names, icon) ? this.names[icon] : icon;
    },
    // The guild emoji for an icon, or null
    emoji(icon) {
        return icon ? this.found.get(this.name(icon)) || null : null;
    },
    // An icon as message text, or nothing when it has no emoji
    get(icon) {
        const e = this.emoji(icon);
        return e ? e.toString() : '';
    },
    // Several icons together, followed by a space when there are any, to go before what they stand for
    icons(...icons) {
        const text = icons.flat().map(i => this.get(i)).join('');
        return text ? `${text} ` : '';
    },
    // A Privilege's icon, the local one where the game has one, and a Privilege the bot doesn't know as none, as the game clamps it
    privilege(privilege, local) {
        const privs = ['none', 'player', 'supporter', 'moderator', 'administrator', 'developer', 'founder'], locals = ['supporter', 'moderator', 'administrator'];
        let priv = String(privilege || '').toLowerCase();
        if (priv === 'creator') priv = 'founder'; // servers and masters from before the top Privilege's rename
        if (!privs.includes(priv)) priv = 'none';
        return local && locals.includes(priv) ? `local${priv}` : priv;
    }
};
