const { ApplicationCommandOptionType, escapeMarkdown } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'quote',
            description: 'Search for quotable moments.',
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: 'target',
                    description: 'Select target.',
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.String,
                    name: 'search',
                    description: 'Select search terms.',
                    required: false
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

        const str = action.options.getString('search'), result = global.quote.query(target, str, global.access.level(action.guild, action.user));
        if (!result) {
            let msg = 'There are no quotes';
            if (target) msg += ` by '${escapeMarkdown(target)}'`;
            if (str) msg += ` matching '${escapeMarkdown(str)}'`;
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
        await action.reply({ embeds: [ embed ] });
    },
};
