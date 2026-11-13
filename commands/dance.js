const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'dance',
            description: 'Dances or gives someone a lap dance.',
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
        const user = action.options.getUser('user');
        const count = global.stats.inc('dance'), mile = global.stats.milestone(count, 'dance to be performed');
        const embed = {
            color: 0x8888ff,
            title: '💃 Dance',
            description: user
                ? `<@${bot.user.id}> gives <@${user.id}> a lap dance - oooh-lah-lah`
                : `<@${bot.user.id}> dances like a jolly idiot`
        };
        if (mile) embed.footer = { text: mile };
        await action.reply({ embeds: [ embed ] });
    },
};
