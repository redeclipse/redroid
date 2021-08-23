const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    async execute(bot, iact) {
        await iact.reply({ content: 'Pong! You smell.', ephemeral: true });
    },
};
