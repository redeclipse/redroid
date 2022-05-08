module.exports = {
    name: 'guildBanRemove',
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
            type: 'MEMBER_BAN_REMOVE'
        });
        const banlog = audit.entries.first();

        if (banlog) embed.description += ` by <@${banlog.executor.id}>.`;
        else embed.description += '.';

        chan.send({ embeds: [embed] });
    },
};
