const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'oracle',
            description: 'Consults the Oracle regarding the future.',
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: 'question',
                    description: 'Ask a question',
                    required: true
                }
            ]
        }
    },
    async execute(bot, action) {
        let question = action.options.getString('question');
        if (question.slice(-1) != '?') question += '?';
        const count = global.stats.inc('oracle'), mile = global.stats.milestone(count, 'future predicted');
        const embed = {
            color: 0x8888ff,
            title: '🎱 Oracle',
            description: `<@${action.user.id}> asks: *${question}*\n\n`
        };
        if (mile) embed.footer = { text: mile };
        embed.description += `<@${bot.user.id}> `;
        embed.description += global.dict.query('consult', action.user, action.user, question);
        embed.description += ', the answer is: *';
        let ans = null;
        if (global.tools.rand(0, 4) === 0) {
            const level = global.access.level(action.guild, action.user);
            const member = action.member || await global.tools.getmember(action, action.user);
            const canonical = global.users.bymember(member || action.user);
            let qot = canonical ? global.quote.query(canonical, null, level) : null;
            if (!qot && member) qot = global.quote.query(member.displayName, null, level);
            if (!qot) qot = global.quote.query(action.user.username, null, level);
            if (!qot) qot = global.quote.query(null, null, level);
            if (qot && qot.value) {
                ans = qot.value.body.replace(/@u|@n/g, () => `<@${action.user.id}>`).replace(/@q/g, () => question);
            }
        }
        if (!ans) ans = global.dict.query('answer', action.user, action.user, question);
        embed.description += ans;
        embed.description += '*';
        await action.reply({ embeds: [ embed ] });
    },
};
