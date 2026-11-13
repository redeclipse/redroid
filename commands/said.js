const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'said',
            description: 'Tracks how many times "that\'s what she/he said" has been said.',
            options: [
                {
                    type: ApplicationCommandOptionType.Boolean,
                    name: 'stats',
                    description: 'Show count without incrementing.',
                    required: false
                }
            ]
        }
    },
    last: 0,
    async execute(bot, action) {
        const statsonly = action.options.getBoolean('stats');
        let count = global.stats.get('said'), mile = null;
        if (!statsonly) {
            const now = Date.now(), cooldown = global.stats.config.said_cooldown;
            if (now - this.last >= cooldown) {
                this.last = now;
                count = global.stats.inc('said');
                mile = global.stats.milestone(count, 'time they said it');
            }
        }
        const embed = {
            color: 0x8888ff,
            title: '😏 That\'s What They Said',
            description: `They've said it a total of **${count}** times.`
        };
        if (mile) embed.footer = { text: mile };
        await action.reply({ embeds: [ embed ] });
    },
};
