const { Events, escapeMarkdown } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,
    execute(bot, member) {
        global.log.out(`<@${member.id}> (${member.user.tag}) has joined the server.`);
        if (global.audit) global.audit.memberadd(member);
        if (member.user.bot) return;
        const members = member.guild.members.cache.filter(m => !m.user.bot).size;
        global.post.notice({
            color: 0x88ff88,
            title: '👋 Join',
            text: `<@${member.id}> (${escapeMarkdown(member.user.tag)}) has joined the server (#${members}).`,
            thumbnail: member.user.displayAvatarURL()
        });
    },
};
