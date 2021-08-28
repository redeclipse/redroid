module.exports = {
    config: {
        chat: {
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
        const user = global.tools.defaultuser(action, 'target');
        const level = global.access.level(action.guild, user);
        action.reply({
            embeds: [{
                color: 0x8888ff,
                title: `👤 Access: <@${user.id}>`,
                description: `Level: ${level}`
            }]
        });
    },
};
