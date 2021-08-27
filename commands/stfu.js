module.exports = {
    config: {
        chat: {
            name: 'stfu',
            description: 'Tells someone to STFU.',
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
            name: 'Stfu',
            type: 2
        },
        level: 1
    },
    execute(bot, action) {
        const user = global.tools.pickuser(action, 'user');
        let data = `<@${action.user.id}> `;
        data += global.dict.query('insert', action.user, user);
        data += ' ';
        data += global.dict.query('object', action.user, user);
        data += ` into <@${user.id}>'s `;
        data += global.dict.query('orifice', action.user, user);
        data += ' and tells them to ';
        data += global.dict.query('stfu', action.user, user);
        action.reply({ content: data });
    },
};
