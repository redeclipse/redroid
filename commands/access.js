module.exports = {
    config: {
        chat: {
            name: 'access',
            description: 'Obtains access levels.',
            options: [
                {
                    type: 6,
                    name: 'user',
                    description: 'Select a user',
                    required: false
                }
            ]
        },
        level: 0
    },
    async execute(bot, action) {
        const user = global.tools.defaultuser(action, 'user');
        const level = global.access.level(action.guild, user);
        if (level >= 0) {
            action.reply({
                embeds: [{
                    color: 0x8888ff,
                    title: '👤 Access',
                    description: `<@${user.id}>'s level is: ${level}`
                }]
            });
        }
        else { action.reply({ content: 'https://www.youtube.com/watch?v=SiMHTK15Pik' }); }
    },
};
