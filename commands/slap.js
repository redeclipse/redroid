const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slap')
        .setDescription('Slaps someone good.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(bot, action) {
        let user = action.options.getUser('target');
        if (!user) user = action.user;
        let data = `<@${action.user.id}> slaps <@${user.id}> `;
        data += global.dict.query('action', action.user, user);
        data += ' using ';
        data += global.dict.query('object', action.user, user);
        await action.reply({
            content: data
        });
    },
};
