const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slap')
        .setDescription('Prints an multi user dungeon event.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(bot, iact) {
        let user = iact.options.getUser('target');
        if (!user) user = iact.user;
        let data = `**${iact.user.username}** slaps **${user.username}** `;
        data += bot.dict.query('action', -1, iact.user.username, user.username);
        data += ' using ';
        data += bot.dict.query('object', -1, iact.user.username, user.username);
        await iact.reply({
            content: data
        });
    },
};
