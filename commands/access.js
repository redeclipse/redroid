const { SlashCommandBuilder } = require('@discordjs/builders');
const bot = require('../lib/bot.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('access')
        .setDescription('Obtains access levels.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(interaction) {
        let user = interaction.options.getUser('target');
        if (!user) user = interaction.user;
        await interaction.reply({
            content: '**' + user.username + '\'s** level is: **' + bot.level(interaction.guild, user) + '**'
        });
    },
};
