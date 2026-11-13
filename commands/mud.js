const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'mud',
            description: 'MUD event: <user> {verb} {adverb} {object}',
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
        const user = await global.tools.pickuser(action, 'user');
        const embed = {
            color: 0x8888ff,
            title: '🎬 MUD',
            description: `<@${user.id}> `
        };
        embed.description += global.dict.query('verb', action.user, user);
        embed.description += ' ';
        embed.description += global.dict.query('adverb', action.user, user);
        embed.description += ' ';
        embed.description += global.dict.query('object', action.user, user);
        await action.reply({ embeds: [ embed ] });
    },
};
