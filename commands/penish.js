module.exports = {
    config: {
        chat: {
            name: 'penish',
            description: 'Measures penishes.',
            options: [
                {
                    type: 6,
                    name: 'user',
                    description: 'Select a user',
                    required: false
                }
            ]
        },
        user: {
            name: 'Penish',
            type: 2
        },
        level: 1
    },
    magic: [12, 8, 20, 15, 8, 1, 6, 9, 15, -2, -21, -2, 5, 12, 19, 5, 8, -12, 6, -2, 14, 9, -8, 1, 6, -9, 15, 2, 21, 2, -8, 12, -19, 5, 8, -20],
    async execute(bot, action) {
        const member = await global.tools.defaultmember(action, 'user');
        const str = member.displayName.toLowerCase();
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
        const level = global.access.level(action.guild, member.user), bonus = 10 - str.length, inter = ret / str.length, result = inter + bonus + level, imperial = result * 0.393700787,
            centimeters = result.toFixed(2), inches = imperial.toFixed(2), score = centimeters * 100.0 / 46.0, percent = score.toFixed(2);
        const embed = {
            color: 0x8888ff,
            title: '<:largeandincharge_1:743871161099747399><:largeandincharge_2:743871143764689067><:largeandincharge_3:743871119265759313><:largeandincharge_4:743871101393698959>',
            description: `Measuring <@${member.user.id}>:\n`,
            footer: { text: '' }
        };
        embed.description += '```\n';
        embed.description += `${math} / LEN[${str.length}] + BONUS[${bonus}]`;
        if (level > 0) embed.description += ` + LEVEL[${level}]`;
        embed.description += '\n';
        embed.description += `= ${ret} / ${str.length} + ${bonus}`;
        if (level > 0) embed.description += ` + ${level}`;
        embed.description += ` = ${inter} + ${bonus}`;
        if (level > 0) embed.description += ` + ${level}`;
        embed.description += '\n';
        embed.description += `= ${centimeters}cm [${inches}in]\n`;
        embed.description += '```';
        embed.footer.text = `Score: ${percent}%`;
        action.reply({ embeds: [ embed ] });
    },
};
