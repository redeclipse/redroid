const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('access')
        .setDescription('Obtains access levels.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(bot, action) {
        let user = action.options.getUser('target');
        if (!user) user = action.user;
        const level = global.access.level(action.guild, user);
        await action.reply({
            content: `<@${user.id}>'s level is: ** ${level} **`
        });
    },
};
