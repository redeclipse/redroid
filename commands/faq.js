const { ApplicationCommandOptionType, escapeMarkdown } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'faq',
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
        }
    },
    async execute(bot, action) {
        const target = action.options.getString('target'), str = action.options.getString('search'), data = global.faq.query(target, str, global.access.level(action.guild, action.user));
        if (!data || !data.value || !data.value.length) {
            let msg = 'There are no FAQs';
            if (target) msg += ` for '${escapeMarkdown(target)}'`;
            if (str) msg += ` matching '${escapeMarkdown(str)}'`;
            msg += '.';
            throw msg;
        }

        global.stats.inc('faq');
        const embed = {
            color: 0x8888ff,
            title: `⁉ FAQ: ${data.name}`,
            description: str ? `Searching for: ${escapeMarkdown(str)}` : 'Showing all entries',
            fields: [],
            footer: { text: '' }
        };
        const result = global.tools.embedfields(embed, data.value);

        if (result.more) embed.footer.text += `Results truncated, showing ${result.amount} of ${result.count} match(es).`;
        else embed.footer.text += `There are a total of ${result.count} match(es).`;
        await action.reply({ embeds: [embed] });
    },
};
