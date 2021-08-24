const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    level: 0,
    data: new SlashCommandBuilder()
        .setName('access')
        .setDescription('Obtains access levels.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(bot, action) {
        const user = global.tools.defaultuser(action, 'target');
        const level = global.access.level(action.guild, user);
        await action.reply({
            content: `<@${user.id}>'s level is: ** ${level} **`
        });
    },
};
