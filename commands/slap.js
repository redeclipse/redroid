module.exports = {
    config: {
        chat: {
            name: 'slap',
            description: 'Slaps someone good.',
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
            name: 'Slap',
            type: 2
        },
        level: 1,
    },
    execute(bot, action) {
        const user = global.tools.pickuser(action, 'user');
        let data = `<@${action.user.id}> slaps <@${user.id}> `;
        data += global.dict.query('action', action.user, user);
        data += ' using ';
        data += global.dict.query('object', action.user, user);
        action.reply({ content: data });
    },
};
