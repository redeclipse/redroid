const { ApplicationCommandOptionType, ApplicationCommandType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'infect',
            description: 'Infect people: <user> was {transmit} with {region} {disease}',
            options: [
                {
                    type: ApplicationCommandOptionType.User,
                    name: 'user',
                    description: 'Select a user',
                    required: false
                }
            ]
        },
        user: {
            name: 'Infect',
            type: ApplicationCommandType.User
        }
    },
    async execute(bot, action) {
        const user = await global.tools.pickuser(action, 'user');
        const count = global.stats.inc('infect'), mile = global.stats.milestone(count, 'infection');
        const embed = {
            color: 0x8888ff,
            title: '🤮 Infect',
            description: `<@${user.id}> was `
        };
        if (mile) embed.footer = { text: mile };
        embed.description += global.dict.query('transmit', action.user, user);
        embed.description += ' with ';
        embed.description += global.dict.query('region', action.user, user);
        embed.description += ' ';
        embed.description += global.dict.query('disease', action.user, user);
        await action.reply({ embeds: [ embed ] });
    },
};
