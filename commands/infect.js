module.exports = {
    config: {
        data: {
            name: 'infect',
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
    async execute(bot, action) {
        const user = await global.tools.pickuser(action, 'target');
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
