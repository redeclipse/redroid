const { ApplicationCommandOptionType, escapeMarkdown } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'faq',
            description: 'Look up or search the FAQ.',
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: 'target',
                    description: 'Select topic or target.',
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
        if (!data || ((!data.value || !data.value.length) && (!data.matches || !Object.keys(data.matches).length))) {
            let msg = 'There are no FAQs';
            if (rawtarget) msg += ` for '${escapeMarkdown(rawtarget)}'`;
            if (str) msg += ` matching '${escapeMarkdown(str)}'`;
            msg += '.';
            throw msg;
        }

        global.stats.inc('faq');
        const icon = global.emoji.icons('question');
        const embed = {
            color: 0x8888ff,
            description: data.name
                ? `${icon}**FAQ: ${escapeMarkdown(data.name)}**${str ? `\n*Searching for: ${escapeMarkdown(str)}*` : ''}`
                : `${icon}**FAQ Search** — *${escapeMarkdown(str)}*`,
            footer: { text: '' }
        };
        if (data.matches) {
            const keys = Object.keys(data.matches);
            let shown = 0;
            for (const key of keys) {
                const line = `\n**${escapeMarkdown(key)}:** ${data.matches[key].join(' | ')}`;
                if (embed.description.length + line.length > 4000) break;
                embed.description += line;
                shown++;
            }
            embed.footer.text = `FAQ ${shown} of ${data.total}`;
        }
        else if (data.value.length === 1) {
            embed.description += `\n${data.value[0]}`;
            embed.footer.text = `FAQ ${data.index} of ${data.total}`;
            if (data.also && data.also.length) {
                const extra = data.also.slice(0, 10).join(', ') + (data.also.length > 10 ? ', ...' : '');
                embed.footer.text += ` • Also matching: ${extra}`;
            }
        }
        else {
            for (let i = 0; i < data.value.length; i++) {
                const line = `\n**${i + 1}.** ${data.value[i]}`;
                if (embed.description.length + line.length > 4000) break;
                embed.description += line;
            }
            embed.footer.text = `FAQ ${data.index} of ${data.total}`;
            if (data.also && data.also.length) {
                const extra = data.also.slice(0, 10).join(', ') + (data.also.length > 10 ? ', ...' : '');
                embed.footer.text += ` • Also matching: ${extra}`;
            }
        }
        await action.reply({ embeds: [embed] });
    },
};
