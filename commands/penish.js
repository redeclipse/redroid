const { SlashCommandBuilder } = require('@discordjs/builders');
const bot = require('../lib/bot.js');

const penish_mangle = [12, 8, 20, 15, 8, 1, 6, 9, 15, -2, -21, -2, 5, 12, 19, 5, 8, -12, 6, -2, 14, 9, -8, 1, 6, -9, 15, 2, 21, 2, -8, 12, -19, 5, 8, -20];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('penish')
        .setDescription('Measures penishes.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    async execute(interaction) {
        let user = interaction.options.getUser('target');
        if (!user) user = interaction.user;
        const str = user.username.toLowerCase();
        let ret = 0, math = '';
        for (let i = 0; i < str.length; i++) {
            const chr = str.charCodeAt(i), man = penish_mangle[i];
            let dec = chr - 96;
            if (dec >= 27) dec = 0 - dec;
            dec = ((dec + man) % 30) + 1;
            ret += dec;
            if (math) math += ' + ';
            math += str[i].toUpperCase() + '[' + dec + ']';
        }
        const level = bot.level(interaction.guild, user), bonus = 10 - str.length + level, result = (ret / str.length) + bonus, imperial = result * 0.393700787;
        await interaction.reply({
            content: '**' + user.username + '\'s** penish measurement:\n```\n' + math + ' / LEN[' + str.length + '] + BONUS[' + bonus + '] = ' + result.toFixed(2) + 'cm (' + imperial.toFixed(2) + 'in)\n```'
        });
    },
};
