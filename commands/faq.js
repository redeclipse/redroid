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
        const rawtarget = action.options.getString('target'), str = action.options.getString('search');
        const level = global.access.level(action.guild, action.user);
        let target = rawtarget;
        if (rawtarget && rawtarget.slice(0, 1) !== '/') {
            const resolved = await global.users.resolve(action, rawtarget);
            if (resolved && (global.faq.faqs[resolved.name] || Object.keys(global.faq.faqs).some(k => k.toLowerCase() === resolved.name.toLowerCase()))) {
                target = resolved.name;
            }
        }
        const data = global.faq.query(target, str, level);
        if (!data || !data.value || !data.value.length) {
            let msg = 'There are no FAQs';
            if (rawtarget) msg += ` for '${escapeMarkdown(rawtarget)}'`;
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
