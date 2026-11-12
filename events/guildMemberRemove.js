const { Events, escapeMarkdown } = require('discord.js');

module.exports = {
    name: Events.GuildMemberRemove,
    once: false,
    execute(bot, member) {
        global.log.audit(`<@${member.id}> (${member.user.tag}) has left the server.`);
        if (member.user.bot) return;
        const members = member.guild.members.cache.filter(m => !m.user.bot).size;
        global.post.notice({
            color: 0x88ff88,
            title: '⛔ Leave',
            text: `<@${member.id}> (${escapeMarkdown(member.user.tag)}) has left the server (#${members}).`,
            thumbnail: member.user.displayAvatarURL(),
            react: '839202957135446097'
        });
    },
};
