module.exports = {
    config: {
        chat: {
            name: 'faq',
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
        level: 1
    },
    async execute(bot, action) {
        const target = action.options.getString('target'), str = action.options.getString('search'), data = global.faq.query(target, str);
        if (!data || !data.value.length) {
            let msg = 'There are no FAQs';
            if (target) msg += ` for '${target}'`;
            if (str) msg += ` matching '${str}'`;
            msg += '.';
            throw msg;
        }

        const embed = {
            color: 0x8888ff,
            title: `⁉ FAQ: ${data.name}`,
            description: str ? `Searching for: ${str}` : 'Showing all entries',
            fields: [],
            footer: { text: '' }
        };
        const result = global.tools.embedfields(embed, data.value);

        if (result.more) embed.footer.text += `Results truncated, showing ${result.amount} of ${result.count} match(es).`;
        else embed.footer.text += `There are a total of ${result.count} match(es).`;
        action.reply({ embeds: [embed] });
    },
};
