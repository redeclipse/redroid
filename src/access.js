module.exports = {
    name: 'access',
    // config.access: { users: { <user id>: level }, roles: { <role name>: level } }, applied to config.guildId only
    config: { users: {}, roles: {} },
    guildid: null,
    start(bot) {
        this.guildid = bot.config.guildId;
        this.config = Object.assign({ users: {}, roles: {} }, bot.config.access);
        return true;
    },
    // Per-user levels override roles (-1 blocks a user); otherwise the highest level of the member's roles
    level(guild, user) {
        if (!guild || guild.id !== this.guildid) return 0;
        const member = guild.members.resolve(user);
        if (!member) return 0;
        if (Object.hasOwn(this.config.users, member.id)) return this.config.users[member.id];
        let level = 0;
        for (const role of member.roles.cache.values()) {
            if (Object.hasOwn(this.config.roles, role.name)) level = Math.max(level, this.config.roles[role.name]);
        }
        return level;
    }
};
