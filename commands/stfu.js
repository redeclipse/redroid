const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stfu')
        .setDescription('Tells someone to STFU.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(bot, action) {
        const user = await global.tools.randomuser(action, 'target');
        let data = `<@${action.user.id}> `;
        data += global.dict.query('insert', action.user, user);
        data += ' ';
        data += global.dict.query('object', action.user, user);
        data += ` into <@${user.id}>'s `;
        data += global.dict.query('orifice', action.user, user);
        data += ' and tells them to shut the fuck up';
        await action.reply({
            content: data
        });
    },
};
