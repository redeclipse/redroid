const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    emphemeral: true,
    async execute(interaction) {
        await interaction.reply({ content: 'Pong! You smell.', ephemeral: true });
    },
};
