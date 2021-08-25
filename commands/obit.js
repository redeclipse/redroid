module.exports = {
    config: {
        data: {
            name: 'obit',
            description: 'Prints an obituary.',
            options: [
                {
                    type: 6,
                    name: 'target',
                    description: 'Select a user',
                    required: false
                }
            ]
        },
        level: 1
    },
    async execute(bot, action) {
        const user = await global.tools.pickuser(action, 'target');
        let data = `<@${user.id}> was `;
        data += global.dict.query('killed', action.user, user);
        data += ' with ';
        data += global.dict.query('object', action.user, user);
        if (action.user != user) data += ` by **${action.user}**`;
        if (global.tools.rand(0, 5)) {
            data += ', ';
            data += global.dict.query('style', action.user, user);
        }
        await action.reply({
            content: data
        });
    },
};
