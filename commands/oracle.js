const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oracle')
        .setDescription('Consults the Oracle regarding the future.')
        .addStringOption(option => option.setName('question').setDescription('Ask a question').setRequired(true)),
    async execute(bot, action) {
        let question = action.options.getString('question');
        if (question.slice(-1) != '?') question += '?';
        let data = `<@${action.user.id}> asks: *${question}*\n`;
        data += `<@${action.client.user.id}> `;
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
