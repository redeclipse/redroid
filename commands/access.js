const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'access',
            description: 'Obtains access levels.',
            options: [
                {
                    type: ApplicationCommandOptionType.User,
                    name: 'user',
                    description: 'Select a user',
                    required: false
                }
            ]
        }
    },
    async execute(bot, action) {
        const user = global.tools.defaultuser(action, 'user');
        const level = global.access.level(action.guild, user);
        if (level >= 0) {
            await action.reply({
                embeds: [{
                    color: 0x8888ff,
                    title: '👤 Access',
                    description: `<@${user.id}>'s level is: ${level}`
                }]
            });
        }
        else { await action.reply({ content: 'https://www.youtube.com/watch?v=SiMHTK15Pik' }); }
    },
};
