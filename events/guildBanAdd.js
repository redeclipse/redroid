const { AuditLogEvent, Events, escapeMarkdown } = require('discord.js');

module.exports = {
    name: Events.GuildBanAdd,
    once: false,
    async execute(bot, ban) {
        global.log.out(`<@${ban.user.id}> (${ban.user.tag}) was banned.`);
        const banlog = global.audit
            ? await global.audit.fetchlog(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id)
            : (await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null))?.entries.first();
        if (global.audit) global.audit.banadd(ban, banlog);
        if (ban.user.bot || bot.online !== true || !bot.config.channels.general) return;
        let text = `<@${ban.user.id}> (${escapeMarkdown(ban.user.tag)}) was banned`;

        // The latest entry may belong to a different ban
        if (banlog && banlog.targetId === ban.user.id && banlog.executorId) text += ` by <@${banlog.executorId}> (${banlog.reason ? escapeMarkdown(banlog.reason) : 'No reason'}).`;
        else text += '.';

        global.post.notice({ color: 0x88ffff, title: '🚫 Banned', text, react: bot.config.notices.react });
    },
};
