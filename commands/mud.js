const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mud')
        .setDescription('Prints an multi user dungeon event.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(bot, action) {
        let user = action.options.getUser('target');
        if (!user) user = action.user;
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
