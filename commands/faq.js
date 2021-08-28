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
    execute(bot, action) {
        const target = action.options.getString('target'), str = action.options.getString('search'), results = global.faq.query(target, str);
        if (!results || !results[1].length) {
            let msg = 'There are no FAQs';
            if (target) msg += ` for '${target}''`;
            if (str) msg += ` matching '${str}'`;
            msg += '.';
            throw msg;
        }

        const embed = {
            color: 0x8888ff,
            title: `⁉ FAQ: ${results[0]}`,
            description: str ? `Searching for: ${str}` : 'Showing all entries',
            fields: [],
            footer: { text: '' }
        };

        let count = 0, more = 0;
        for (const result in results[1]) {
            if (embed.fields.length >= 24) { more++; }
            else {
                const index = parseInt(result, 10) + 1;
                embed.fields.push({ name: `[${index}]`, value: results[1][result], inline: true });
            }
            count++;
        }
        if (more) embed.footer.text += `Results truncated, showing ${embed.fields.length} of ${count} match(es).`;
        else embed.footer.text += `There are a total of ${count} match(es).`;
        action.reply({ embeds: [embed] });
    },
};
