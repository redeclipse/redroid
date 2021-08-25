module.exports = {
    config: {
        data: {
            name: 'penish',
            description: 'Measures penishes.',
            options: [
                {
                    type: 6,
                    name: 'target',
                    description: 'Select a user',
                    required: false
                }
            ]
        },
        level: 1
    },
    async execute(bot, action) {
        const member = await global.tools.defaultmember(action, 'target');
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
            centimeters = result.toFixed(2), inches = imperial.toFixed(2);
        let msg = `Penish measurement for <@${member.user.id}>:\n`;
        msg += '```\n';
        msg += `${math} / LEN[${str.length}] + BONUS[${bonus}]`;
        if (level > 0) msg += ` + LEVEL[${level}]`;
        msg += '\n';
        msg += `= ${ret} / ${str.length} + ${bonus}`;
        if (level > 0) msg += ` + ${level}`;
        msg += ` = ${inter} + ${bonus}`;
        if (level > 0) msg += ` + ${level}`;
        msg += '\n';
        msg += `= ${centimeters}cm [${inches}in]\n`;
        msg += '```\n';
        await action.reply({
            content: msg
        });
    },
};
