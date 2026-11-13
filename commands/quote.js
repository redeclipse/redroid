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
        let target = action.options.getString('target');
        const level = global.access.level(action.guild, action.user);
        if (target) {
            const member = await global.tools.resolvemember(action, target);
            if (member) {
                const disp = global.quote.findtarg(member.displayName, level);
                target = global.quote.quotes[disp] ? disp : member.user.username;
            }
        }

        const str = action.options.getString('search'), result = global.quote.query(target, str, level);
        if (!result) {
            let msg = 'There are no quotes';
            if (target) msg += ` by '${escapeMarkdown(target)}'`;
            if (str) msg += ` matching '${escapeMarkdown(str)}'`;
            msg += '.';
            throw msg;
        }

        const count = global.stats.inc('quote'), mile = global.stats.milestone(count, 'quote to be announced');
        const embed = {
            color: 0x8888ff,
            title: '💬 Quote',
            description: `${target ? result.name : 'A random person'} once said:\n`
        };
        if (mile) embed.footer = { text: mile };
        embed.description += '```\n';
        if (result.value.type === 'action') embed.description += `* ${result.name} ${result.value.body}`;
        else embed.description += `<${result.name}> ${result.value.body}`;
        embed.description += '\n```';
        await action.reply({ embeds: [ embed ] });
    },
};
