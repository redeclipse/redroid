const { Events, escapeMarkdown } = require('discord.js');

module.exports = {
    name: Events.GuildMemberRemove,
    once: false,
    async execute(bot, member) {
        global.log.out(`<@${member.id}> (${member.user.tag}) has left the server.`);
        const { kick } = global.audit ? await global.audit.memberremove(member) : { kick: null };
        if (member.user.bot) return;
        const members = member.guild.members.cache.filter(m => !m.user.bot).size;
        if (kick) {
            let text = `<@${member.id}> (${escapeMarkdown(member.user.tag)}) was kicked`;
            if (kick.executorId) text += ` by <@${kick.executorId}> (${kick.reason ? escapeMarkdown(kick.reason) : 'No reason'})`;
            text += ` (#${members}).`;
            global.post.notice({
                color: 0x88ffff,
                title: '🥾 Kicked',
                text,
                thumbnail: member.user.displayAvatarURL(),
                react: bot.config.notices.react
            });
            return;
        }
        global.post.notice({
            color: 0x88ff88,
            title: '⛔ Leave',
            text: `<@${member.id}> (${escapeMarkdown(member.user.tag)}) has left the server (#${members}).`,
            thumbnail: member.user.displayAvatarURL(),
            react: bot.config.notices.react
        });
    },
};
