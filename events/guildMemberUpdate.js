const { Events, escapeMarkdown } = require('discord.js');

module.exports = {
    name: Events.GuildMemberUpdate,
    once: false,
    async execute(bot, oldmember, member) {
        global.log.out(`<@${member.id}> (${member.user.tag}) has updated information.`);
        if (global.audit) await global.audit.memberupdate(oldmember, member);
        if (member.user.bot || oldmember.partial) return;
        if (oldmember.nickname !== member.nickname || oldmember.displayName !== member.displayName) {
            const oldnick = oldmember.nickname ? oldmember.nickname : oldmember.displayName, newnick = member.nickname ? member.nickname : member.displayName;
            global.post.notice({
                color: 0xffff88,
                title: '✉ Nickname Update',
                text: `<@${member.id}> (${escapeMarkdown(oldmember.user.tag)}) renamed from **${escapeMarkdown(oldnick)}** to **${escapeMarkdown(newnick)}**.`
            });
        }
    },
};
