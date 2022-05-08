module.exports = {
    name: 'guildMemberUpdate',
    once: false,
    execute(bot, oldmember, member) {
        global.log.out(`<@${member.id}> (${member.user.tag}) has updated information.`);
        if (member.user.bot || bot.online !== true || !bot.config.channels.general) return;
        const chan = bot.channels.cache.get(bot.config.channels.general);
        if (!chan) return;
        if (oldmember.nickname !== member.nickname || oldmember.displayName !== member.displayName) {
            const oldnick = oldmember.nickname ? oldmember.nickname : oldmember.displayName, newnick = member.nickname ? member.nickname : member.displayName;
            const embed = {
                color: 0xffff88,
                title: '✉ Nickname Update',
                description: `<@${member.id}> (${oldmember.user.tag}) renamed from **${oldnick}** to **${newnick}**.`
            };
            chan.send({ embeds: [embed] });
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
