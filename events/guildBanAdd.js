const { AuditLogEvent, Events } = require('discord.js');

module.exports = {
    name: Events.GuildBanAdd,
    once: false,
    async execute(bot, ban) {
        global.log.audit(`<@${ban.user.id}> (${ban.user.tag}) was banned.`);
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
            type: AuditLogEvent.MemberBanAdd
        });
        const banlog = audit.entries.first();

        // The latest entry may belong to a different ban
        if (banlog && banlog.targetId === ban.user.id && banlog.executorId) embed.description += ` by <@${banlog.executorId}> (${banlog.reason ? banlog.reason : 'No reason'}).`;
        else embed.description += '.';

        chan.send({ embeds: [embed] }).then(s => global.tools.react(s, '839202957135446097'));
    },
};
