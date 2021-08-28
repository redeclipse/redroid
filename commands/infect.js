module.exports = {
    config: {
        chat: {
            name: 'infect',
            description: 'Infect people: <user> was {transmit} with {region} {disease}',
            options: [
                {
                    type: 6,
                    name: 'user',
                    description: 'Select a user',
                    required: false
                }
            ]
        },
        user: {
            name: 'Infect',
            type: 2
        },
        level: 1
    },
    async execute(bot, action) {
        const user = await global.tools.pickuser(action, 'user');
        const embed = {
            color: 0x8888ff,
            title: '🤮 Infect',
            description: `<@${user.id}> was `
        };
        embed.description += global.dict.query('transmit', action.user, user);
        embed.description += ' with ';
        embed.description += global.dict.query('region', action.user, user);
        embed.description += ' ';
        embed.description += global.dict.query('disease', action.user, user);
        action.reply({ embeds: [ embed ] });
    },
};
