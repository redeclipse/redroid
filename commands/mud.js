module.exports = {
    config: {
        chat: {
            name: 'mud',
            description: 'Prints an multi user dungeon event.',
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
    execute(bot, action) {
        const user = global.tools.pickuser(action, 'target');
        let data = `<@${user.id}> `;
        data += global.dict.query('verb', action.user, user);
        data += ' ';
        data += global.dict.query('adverb', action.user, user);
        data += ' ';
        data += global.dict.query('object', action.user, user);
        action.reply({ content: data });
    },
};
