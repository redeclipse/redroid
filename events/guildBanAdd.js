module.exports = {
    name: 'guildBanAdd',
    once: false,
    async execute(bot, ban) {
        global.log.out(`<@${ban.user.id}> (${ban.user.tag}) was banned.`);
        if (ban.user.bot || bot.online !== true || !bot.config.channels.general) return;
        const chan = bot.channels.cache.get(bot.config.channels.general);
        if (!chan) return;
        const embed = {
            color: 0x88ffff,
            title: '🚫 Banned',
            description: `<@${ban.user.id}> (${ban.user.tag}) was banned`
        };

        const audit = await ban.guild.fetchAuditLogs({
            limit: 1,
            type: 'MEMBER_BAN_ADD'
        });
        const banlog = audit.entries.first();

        if (banlog) embed.description += ` by <@${banlog.executor.id}> (${banlog.reason ? banlog.reason : 'No reason'}).`;
        else embed.description += '.';

        chan.send({ embeds: [embed] }).then(s => s.react(ban.guild.emojis.cache.get('839202957135446097')));
    },
};
