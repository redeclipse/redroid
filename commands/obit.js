const { SlashCommandBuilder } = require('@discordjs/builders');
const tools = require('../lib/tools.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('obit')
        .setDescription('Prints an obituary.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(bot, iact) {
        let user = iact.options.getUser('target');
        if (!user) user = iact.user;
        let data = `**${user.username}** was `;
        data += bot.dict.query('killed', -1, iact.user.username, user.username);
        data += ' with ';
        data += bot.dict.query('object', -1, iact.user.username, user.username);
        if (iact.user != user) data += ` by **${iact.user.username}**`;
        if (tools.rand(0, 5)) {
            data += ', ';
            data += bot.dict.query('style', -1, iact.user.username, user.username);
        }
        await iact.reply({
            content: data
        });
    },
};
