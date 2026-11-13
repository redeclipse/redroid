const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'cookie',
            description: 'Chops someone up and makes cookies out of the pieces.',
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
        const count = global.stats.inc('cookie'), mile = global.stats.milestone(count, 'batch of cookies baked');
        const embed = {
            color: 0x8888ff,
            title: '🍪 Cookie',
            description: `<@${bot.user.id}> chops <@${user.id}> up and makes cookies out of the pieces`
        };
        if (mile) embed.footer = { text: mile };
        await action.reply({ embeds: [ embed ] });
    },
};
