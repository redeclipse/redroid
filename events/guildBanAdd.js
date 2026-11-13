const { AuditLogEvent, Events, escapeMarkdown } = require('discord.js');

module.exports = {
    name: Events.GuildBanAdd,
    once: false,
    async execute(bot, ban) {
        global.log.audit(`<@${ban.user.id}> (${ban.user.tag}) was banned.`);
        if (ban.user.bot || bot.online !== true || !bot.config.channels.general) return;
        let text = `<@${ban.user.id}> (${escapeMarkdown(ban.user.tag)}) was banned`;

        const audit = await ban.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberBanAdd
        });
        const banlog = audit.entries.first();

        // The latest entry may belong to a different ban
        if (banlog && banlog.targetId === ban.user.id && banlog.executorId) text += ` by <@${banlog.executorId}> (${banlog.reason ? escapeMarkdown(banlog.reason) : 'No reason'}).`;
        else text += '.';

        global.post.notice({ color: 0x88ffff, title: '🚫 Banned', text, react: bot.config.notices.react });
    },
};
