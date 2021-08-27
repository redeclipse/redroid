module.exports = {
    config: {
        chat: {
            name: 'infect',
            description: 'Infect people with various things.',
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
        let data = `<@${user.id}> was `;
        data += global.dict.query('transmit', action.user, user);
        data += ' with ';
        data += global.dict.query('region', action.user, user);
        data += ' ';
        data += global.dict.query('disease', action.user, user);
        await action.reply({
            content: data
        });
    },
};
