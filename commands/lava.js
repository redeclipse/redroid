const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'lava',
            description: 'Throws someone into the lava.',
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
        const count = global.stats.inc('lava'), mile = global.stats.milestone(count, 'lava sacrifice');
        const embed = {
            color: 0x8888ff,
            title: '🌋 Lava',
            description: `<@${bot.user.id}> throws <@${user.id}> into the lava and laughs maniacally with <@${action.user.id}> as they burn`
        };
        if (mile) embed.footer = { text: mile };
        await action.reply({ embeds: [ embed ] });
    },
};
