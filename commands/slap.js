const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    level: 1,
    data: new SlashCommandBuilder()
        .setName('slap')
        .setDescription('Slaps someone good.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(bot, action) {
        const user = await global.tools.pickuser(action, 'target');
        let data = `<@${action.user.id}> slaps <@${user.id}> `;
        data += global.dict.query('action', action.user, user);
        data += ' using ';
        data += global.dict.query('object', action.user, user);
        await action.reply({
            content: data
        });
    },
};
