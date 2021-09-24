module.exports = {
    name: 'guildMemberRemove',
    once: false,
    execute(bot, member) {
        global.log.out(`<@${member.id}> (${member.user.tag}) has left the server.`);
        if (member.user.bot || bot.online !== true || !bot.config.channels.general) return;
        const chan = bot.channels.cache.get(bot.config.channels.general);
        if (!chan) return;
        const members = member.guild.members.cache.filter(m => !m.user.bot).size;
        const embed = {
            color: 0x88ff88,
            title: '⛔ Leave',
            description: `<@${member.id}> (${member.user.tag}) has left the server (#${members}).`,
            thumbnail: {
                url: member.user.displayAvatarURL()
            }
        };
        chan.send({ embeds: [ embed ] }).then(s => s.react(member.guild.emojis.cache.get('839202957135446097')));
    },
};
