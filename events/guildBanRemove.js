const { AuditLogEvent, Events } = require('discord.js');

module.exports = {
    name: Events.GuildBanRemove,
    once: false,
    async execute(bot, ban) {
        global.log.audit(`<@${ban.user.id}> (${ban.user.tag}) was unbanned.`);
        if (ban.user.bot || bot.online !== true || !bot.config.channels.general) return;
        let text = `<@${ban.user.id}> (${ban.user.tag}) was unbanned`;

        const audit = await ban.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberBanRemove
        });
        const banlog = audit.entries.first();

        // The latest entry may belong to a different ban
        if (banlog && banlog.targetId === ban.user.id && banlog.executorId) text += ` by <@${banlog.executorId}>.`;
        else text += '.';

        global.post.notice({ color: 0x88ffff, title: '🔆 Unbanned', text });
    },
};
