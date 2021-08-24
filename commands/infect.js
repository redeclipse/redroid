const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('infect')
        .setDescription('Prints an multi user dungeon event.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(bot, action) {
        let user = action.options.getUser('target');
        if (!user) user = action.user;
        let data = `<@${user.id}> was `;
        data += global.dict.query('transmit', action.user, user);
        data += ' with ';
        data += global.dict.query('region', action.user, user);
        data += ' ';
        data += global.dict.query('disease', action.user, user);
        await action.reply({
            content: data
        });
    },
};
