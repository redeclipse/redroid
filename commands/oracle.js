module.exports = {
    config: {
        chat: {
            name: 'oracle',
            description: 'Consults the Oracle regarding the future.',
            options: [
                {
                    type: 3,
                    name: 'question',
                    description: 'Ask a question',
                    required: true,
                    choices: null
                }
            ]
        },
        level: 1
    },
    async execute(bot, action) {
        let question = action.options.getString('question');
        if (question.slice(-1) != '?') question += '?';
        const embed = {
            color: 0x8888ff,
            title: '🎱 Oracle',
            description: `<@${action.user.id}> asks: *${question}*\n\n`
        };
        embed.description += `<@${bot.user.id}> `;
        embed.description += global.dict.query('consult', action.user, action.user, question);
        embed.description += ', the answer is: ';
        // TODO: add random answers from quotes?
        embed.description += '*';
        embed.description += global.dict.query('answer', action.user, action.user, question);
        embed.description += '*';
        action.reply({ embeds: [embed] });
    },
};
