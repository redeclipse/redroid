module.exports = {
    config: {
        chat: {
            name: 'quote',
            description: 'Search for quotable moments.',
            options: [
                {
                    type: 3,
                    name: 'target',
                    description: 'Select target.',
                    required: false,
                    choices: null
                },
                {
                    type: 3,
                    name: 'search',
                    description: 'Select search terms.',
                    required: false,
                    choices: null
                }
            ]
        },
        level: 1,
    },
    async execute(bot, action) {
        /*
        <@!189189124194959361>
        if (target) {
            const match = str.match(/^<@!(.*?)>$/);
            if (match) {
                const user = action.client.users.cache(u => u.id === match[0]);
                target = user.username;
            }
        }
        */
        const target = action.options.getString('target');
        if (target && target.slice(0, 2) === '<@') throw 'Searching by Discord ID is not yet supported. Try their IRC nickname?';

        const str = action.options.getString('search'), result = global.quote.query(target, str);
        if (!result) {
            let msg = 'There are no quotes';
            if (target) msg += ` by '${target}'`;
            if (str) msg += ` matching '${str}'`;
            msg += '.';
            throw msg;
        }

        const embed = {
            color: 0x8888ff,
            title: '💬 Quote',
            description: `${target ? result.name : 'A random person'} once said:\n`
        };
        embed.description += '```\n';
        embed.description += '<' + result.name + '> ' + result.value;
        embed.description += '```';
        action.reply({ embeds: [ embed ] });
    },
};
