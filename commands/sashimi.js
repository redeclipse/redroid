const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'sashimi',
            description: 'Slices someone up and serves them with soy sauce and wasabi.',
            options: [
                {
                    type: ApplicationCommandOptionType.User,
                    name: 'user',
                    description: 'Select a user',
                    required: false
                }
            ]
        }
    },
    async execute(bot, action) {
        const user = await global.tools.pickuser(action, 'user');
        const count = global.stats.inc('sashimi'), mile = global.stats.milestone(count, 'plate of sashimi served');
        const embed = {
            color: 0x8888ff,
            title: '🍣 Sashimi',
            description: `<@${bot.user.id}> expertly slices <@${user.id}> and serves them up with soy sauce and wasabi`
        };
        if (mile) embed.footer = { text: mile };
        await action.reply({ embeds: [ embed ] });
    },
};
