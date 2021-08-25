module.exports = {
    config: {
        data: {
            name: 'access',
            description: 'Obtains access levels.',
            options: [
                {
                    type: 6,
                    name: 'target',
                    description: 'Select a user',
                    required: false
                }
            ]
        },
        level: 0
    },
    async execute(bot, action) {
        const user = await global.tools.defaultuser(action, 'target');
        const level = global.access.level(action.guild, user);
        await action.reply({
            content: `<@${user.id}>'s level is: ** ${level} **`
        });
    },
};
