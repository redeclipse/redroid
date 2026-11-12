const { Events, escapeMarkdown } = require('discord.js');

module.exports = {
    name: Events.GuildMemberUpdate,
    once: false,
    execute(bot, oldmember, member) {
        global.log.out(`<@${member.id}> (${member.user.tag}) has updated information.`);
        if (member.user.bot) return;
        if (oldmember.nickname !== member.nickname || oldmember.displayName !== member.displayName) {
            const oldnick = oldmember.nickname ? oldmember.nickname : oldmember.displayName, newnick = member.nickname ? member.nickname : member.displayName;
            global.post.notice({
                color: 0xffff88,
                title: '✉ Nickname Update',
                text: `<@${member.id}> (${escapeMarkdown(oldmember.user.tag)}) renamed from **${escapeMarkdown(oldnick)}** to **${escapeMarkdown(newnick)}**.`
            });
        }
        /*
        let found = false;
        member.roles.cache.forEach(role => {
            if ((role.id == bot.config.roles.alpha || role.id == bot.config.roles.omega) && !oldmember.roles.cache.has(role.id)) {
                const embed = {
                    color: 0xffaa88,
                    title: '⚔ Team Update',
                    description: `<@${member.id}> (${member.user.tag}) is now on <@&${role.id}>.`
                };
                chan.send({ embeds: [embed] });
                found = true;
            }
        });
        if (!found) {
            oldmember.roles.cache.forEach(role => {
                if ((role.id == bot.config.roles.alpha || role.id == bot.config.roles.omega) && !member.roles.cache.has(role.id)) {
                    const embed = {
                        color: 0xffaa88,
                        title: '⚔ Team Update',
                        description: `<@${member.id}> (${member.user.tag}) is no longer on <@&${role.id}>.`
                    };
                    chan.send({ embeds: [embed] });
                }
            });
        }
        */
    },
};
