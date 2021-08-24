const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mud')
        .setDescription('Prints an multi user dungeon event.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(bot, iact) {
        let user = iact.options.getUser('target');
        if (!user) user = iact.user;
        let data = `**${user.username}** `;
        data += bot.dict.query('verb', -1, iact.user.username, user.username);
        data += ' ';
        data += bot.dict.query('adverb', -1, iact.user.username, user.username);
        data += ' ';
        data += bot.dict.query('object', -1, iact.user.username, user.username);
        await iact.reply({
            content: data
        });
    },
};
