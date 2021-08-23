const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('access')
        .setDescription('Obtains access levels.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(bot, iact) {
        let user = iact.options.getUser('target');
        if (!user) user = iact.user;
        const level = bot.level(iact.guild, user);
        await iact.reply({
            content: `**${user.username}'s** level is: ** ${level} **`
        });
    },
};
