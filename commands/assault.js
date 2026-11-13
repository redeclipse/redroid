const { ApplicationCommandOptionType, ApplicationCommandType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'assault',
            description: 'Assaults someone: <bot> {assault} <user> {action} using {object}',
            options: [
                {
                    type: ApplicationCommandOptionType.User,
                    name: 'user',
                    description: 'Select a user',
                    required: false
                }
            ]
        },
        user: {
            name: 'Assault',
            type: ApplicationCommandType.User
        },
    },
    async execute(bot, action) {
        const user = await global.tools.pickuser(action, 'user');
        const embed = {
            color: 0x8888ff,
            title: '👊 Assault',
            description: `<@${bot.user.id}> `
        };
        embed.description += global.dict.query('assault', action.user, user);
        embed.description += ` <@${user.id}> `;
        embed.description += global.dict.query('action', action.user, user);
        embed.description += ' using ';
        embed.description += global.dict.query('object', action.user, user);
        await action.reply({ embeds: [ embed ] });
    },
};
