const { ApplicationCommandOptionType, ApplicationCommandType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'stfu',
            description: 'Tells someone to STFU: <author> {insert} {object} into {user}\'s {orifice} and tells them to {stfu}',
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
            name: 'Stfu',
            type: ApplicationCommandType.User
        }
    },
    async execute(bot, action) {
        const user = await global.tools.pickuser(action, 'user');
        const count = global.stats.inc('stfu'), mile = global.stats.milestone(count, 'piece of abuse');
        const embed = {
            color: 0x8888ff,
            title: '👿 STFU',
            description: `<@${action.user.id}> `
        };
        if (mile) embed.footer = { text: mile };
        embed.description += global.dict.query('insert', action.user, user);
        embed.description += ' ';
        embed.description += global.dict.query('object', action.user, user);
        embed.description += ` into <@${user.id}>'s `;
        embed.description += global.dict.query('orifice', action.user, user);
        embed.description += ' and tells them to ';
        embed.description += global.dict.query('stfu', action.user, user);
        await action.reply({ embeds: [ embed ] });
    },
};
