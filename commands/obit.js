module.exports = {
    config: {
        chat: {
            name: 'obit',
            description: 'Prints an obituary: <user> was {killed} with {object} [by <author>] [, {style}]',
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
            name: 'Obit',
            type: 2
        },
        level: 1
    },
    async execute(bot, action) {
        const user = await global.tools.pickuser(action, 'user');
        const embed = {
            color: 0x8888ff,
            title: '☠ Obituary',
            description: `<@${user.id}> was `
        };
        embed.description += global.dict.query('killed', action.user, user);
        embed.description += ' with ';
        embed.description += global.dict.query('object', action.user, user);
        if (action.user != user) embed.description += ` by ${action.user}`;
        if (global.tools.rand(0, 5)) {
            embed.description += ', ';
            embed.description += global.dict.query('style', action.user, user);
        }
        action.reply({ embeds: [ embed ] });
    },
};
