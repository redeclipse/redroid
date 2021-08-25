module.exports = {
    config: {
        data: {
            name: 'slap',
            description: 'Slaps someone good.',
            options: [
                {
                    type: 6,
                    name: 'target',
                    description: 'Select a user',
                    required: false
                }
            ]
        },
        level: 1,
    },
    async execute(bot, action) {
        const user = await global.tools.pickuser(action, 'target');
        let data = `<@${action.user.id}> slaps <@${user.id}> `;
        data += global.dict.query('action', action.user, user);
        data += ' using ';
        data += global.dict.query('object', action.user, user);
        await action.reply({
            content: data
        });
    },
};
