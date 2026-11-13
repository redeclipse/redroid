const { ApplicationCommandOptionType, escapeMarkdown } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'fail',
            description: 'Determines whether something is teh fail or teh win.',
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: 'target',
                    description: 'Target to evaluate.',
                    required: true
                }
            ]
        }
    },
    async execute(bot, action) {
        const raw = action.options.getString('target').trim();
        const count = global.stats.inc('fail'), mile = global.stats.milestone(count, 'failure evaluated');
        const lower = raw.toLowerCase();
        const isbot = lower.includes('redroid') || raw.includes(bot.user.id);
        const member = await global.tools.resolvemember(action, raw);
        const display = member ? `<@${member.user.id}>` : escapeMarkdown(raw);

        let desc;
        if (isbot) {
            desc = `<@${action.user.id}>: Nuh-uh, you are teh fail for even thinking I could be.`;
        }
        else if (global.tools.rand(0, 3) === global.tools.rand(0, 2)) {
            desc = `Nopez, ${display} seems to be teh win.`;
        }
        else {
            desc = `Uhuh, ${display} iz teh fail.`;
        }

        const embed = {
            color: 0x8888ff,
            title: '🏆 Fail or Win',
            description: desc
        };
        if (mile) embed.footer = { text: mile };
        await action.reply({ embeds: [ embed ] });
    },
};
