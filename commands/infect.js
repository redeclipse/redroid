const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('infect')
        .setDescription('Prints an multi user dungeon event.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(bot, iact) {
        let user = iact.options.getUser('target');
        if (!user) user = iact.user;
        // $iif(%to != $me,bot_cmsg $3 %to,describe $3) was $read(db\transmit.txt,n) with $read(db\region.txt,n) $read(db\disease.txt,n)
        let data = `**${user.username}** was `;
        data += bot.dict.query('transmit', -1, iact.user.username, user.username);
        data += ' with ';
        data += bot.dict.query('region', -1, iact.user.username, user.username);
        data += ' ';
        data += bot.dict.query('disease', -1, iact.user.username, user.username);
        await iact.reply({
            content: data
        });
    },
};
