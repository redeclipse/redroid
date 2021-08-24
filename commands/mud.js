const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mud')
        .setDescription('Prints an multi user dungeon event.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(bot, action) {
        const user = await global.tools.randomuser(action, 'target');
        let data = `<@${user.id}> `;
        data += global.dict.query('verb', action.user, user);
        data += ' ';
        data += global.dict.query('adverb', action.user, user);
        data += ' ';
        data += global.dict.query('object', action.user, user);
        await action.reply({
            content: data
        });
    },
};
