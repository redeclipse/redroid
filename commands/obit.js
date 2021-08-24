const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('obit')
        .setDescription('Prints an obituary.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(bot, action) {
        let user = action.options.getUser('target');
        if (!user) user = action.user;
        let data = `<@${user.id}> was `;
        data += global.dict.query('killed', action.user, user);
        data += ' with ';
        data += global.dict.query('object', action.user, user);
        if (action.user != user) data += ` by **${action.user}**`;
        if (global.tools.rand(0, 5)) {
            data += ', ';
            data += global.dict.query('style', action.user, user);
        }
        await action.reply({
            content: data
        });
    },
};
