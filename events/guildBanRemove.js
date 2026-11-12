const { AuditLogEvent, Events } = require('discord.js');

module.exports = {
    name: Events.GuildBanRemove,
    once: false,
    async execute(bot, ban) {
        global.log.out(`<@${ban.user.id}> (${ban.user.tag}) was unbanned.`);
        if (ban.user.bot || bot.online !== true || !bot.config.channels.general) return;
        const chan = bot.channels.cache.get(bot.config.channels.general);
        if (!chan) return;
        const embed = {
            color: 0x88ffff,
            title: '🔆 Unbanned',
            description: `<@${ban.user.id}> (${ban.user.tag}) was unbanned`
        };

        const audit = await ban.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberBanRemove
        });
        const banlog = audit.entries.first();

        // The latest entry may belong to a different ban
        if (banlog && banlog.targetId === ban.user.id && banlog.executorId) embed.description += ` by <@${banlog.executorId}>.`;
        else embed.description += '.';

        chan.send({ embeds: [embed] });
    },
};
