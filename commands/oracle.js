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
                    choices: undefined
                }
            ]
        },
        level: 1
    },
    async execute(bot, action) {
        let question = action.options.getString('question');
        if (question.slice(-1) != '?') question += '?';
        let data = `The Oracle is consulted: *${question}*\n`;
        data += `<@${bot.user.id}> `;
        data += global.dict.query('consult', action.user, action.user, question);
        data += ', the answer is: *';
        // TODO: add random answers from quotes?
        data += global.dict.query('answer', action.user, action.user, question);
        data += '*';
        await action.reply({
            content: data
        });
    },
};
