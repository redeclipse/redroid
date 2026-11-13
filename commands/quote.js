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
    },
    async execute(bot, action) {
        const rawtarget = action.options.getString('target');
        const level = global.access.level(action.guild, action.user);
        let target = rawtarget;
        if (rawtarget && rawtarget.slice(0, 1) !== '/') {
            const resolved = await global.users.resolve(action, rawtarget);
            if (resolved) target = resolved.name;
        }

        const str = action.options.getString('search'), result = global.quote.query(target, str, level);
        if (!result) {
            let msg = 'There are no quotes';
            if (rawtarget) msg += ` by '${escapeMarkdown(rawtarget)}'`;
            if (str) msg += ` matching '${escapeMarkdown(str)}'`;
            msg += '.';
            throw msg;
        }

        const count = global.stats.inc('quote'), mile = global.stats.milestone(count, 'quote to be announced');
        const speaker = global.users.display(result.name, action.guild);
        const embed = {
            color: 0x8888ff,
            title: '💬 Quote',
            description: `${speaker} once said:\n`
        };
        if (mile) embed.footer = { text: mile };
        embed.description += '```\n';
        if (result.value.type === 'action') embed.description += `* ${result.name} ${result.value.body}`;
        else embed.description += `<${result.name}> ${result.value.body}`;
        embed.description += '\n```';
        await action.reply({ embeds: [ embed ] });
    },
};
