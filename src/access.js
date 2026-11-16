module.exports = {
    name: 'access',
    // config.access: { users: { <user id>: level }, privileges: { <Red Eclipse Privilege>: level } }, applied to config.guildId
    // only. A member's level is that of the Red Eclipse account they linked on the website, as the master gives its standing,
    // unless users sets theirs; Discord roles count for nothing, as anyone with Manage Roles could make one of any name
    config: { users: {}, privileges: {} },
    guildid: null,
    account: null, // the website's page for registering an account, for those with no account linked
    profile: null, // the website's account page, where they link Discord
    start(bot) {
        this.guildid = bot.config.guildId;
        this.config = Object.assign({ users: {}, privileges: {} }, bot.config.access);
        this.account = (bot.config.matchmaking || {}).account;
        this.profile = (bot.config.matchmaking || {}).profile;
        return true;
    },
    // Per-user levels override accounts (-1 blocks a user); otherwise the level of the member's linked account, as last
    // looked up, so callers that can wait call refresh first
    level(guild, user) {
        if (!guild || guild.id !== this.guildid) return 0;
        const member = guild.members.resolve(user);
        if (!member) return 0;
        if (Object.hasOwn(this.config.users, member.id)) return this.config.users[member.id];
        const account = global.accounts ? global.accounts.cached(member.id) : null;
        return account && Object.hasOwn(this.config.privileges, account.privilege) ? this.config.privileges[account.privilege] : 0;
    },
    // asks the master which account the member linked, unless that's known recently enough or doesn't matter
    async refresh(guild, user) {
        if (!guild || guild.id !== this.guildid || !global.accounts || !global.accounts.bot) return;
        const id = user.id || user;
        if (Object.hasOwn(this.config.users, id)) return;
        await global.accounts.lookup(id);
    },
    // whether the member has an account linked, as last looked up
    linked(user) {
        return !!(global.accounts && global.accounts.cached(user.id || user));
    },
    accounthelp() {
        return 'You need a Red Eclipse account linked to your Discord account for that. Register one on the Account page of the game\'s Player menu' +
            (this.account ? ` or at <${this.account}>` : '') + `, then sign in at <${this.profile}> and press Link with Discord.`;
    }
};
