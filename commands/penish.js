const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('penish')
        .setDescription('Measures penishes.')
        .addUserOption(option => option.setName('target').setDescription('Select a user')),
    magic: [12, 8, 20, 15, 8, 1, 6, 9, 15, -2, -21, -2, 5, 12, 19, 5, 8, -12, 6, -2, 14, 9, -8, 1, 6, -9, 15, 2, 21, 2, -8, 12, -19, 5, 8, -20],
    async execute(bot, action) {
        let user = action.options.getUser('target');
        if (!user) user = action.user;
        const str = user.username.toLowerCase();
        let ret = 0, math = '';
        for (let i = 0; i < str.length; i++) {
            const chr = str.charCodeAt(i), man = this.magic[i];
            let dec = chr - 96;
            if (dec >= 27) dec = 0 - dec;
            dec = ((dec + man) % 30) + 1;
            ret += dec;
            if (math) math += ' + ';
            math += (chr == 32 ? '_' : str[i].toUpperCase()) + `[${dec}]`;
        }
        const level = global.access.level(action.guild, user), bonus = 10 - str.length + level, result = (ret / str.length) + bonus, imperial = result * 0.393700787,
            centimeters = result.toFixed(2), inches = imperial.toFixed(2);
        await action.reply({
            content: `<@${user.id}>'s penish measurement:\n\`\`\`\n ${math} / LEN[${str.length}] + BONUS[${bonus}] =  ${centimeters}cm (${inches}in)\n\`\`\``
        });
    },
};
