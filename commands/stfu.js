module.exports = {
    config: {
        chat: {
            name: 'stfu',
            description: 'Tells someone to STFU: <author> {insert} {object} into {user}\'s {orifice} and tells them to {stfu}',
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
    async execute(bot, action) {
        const user = await global.tools.pickuser(action, 'user');
        const embed = {
            color: 0x8888ff,
            title: '👿 STFU',
            description: `<@${action.user.id}> `
        };
        embed.description += global.dict.query('insert', action.user, user);
        embed.description += ' ';
        embed.description += global.dict.query('object', action.user, user);
        embed.description += ` into <@${user.id}>'s `;
        embed.description += global.dict.query('orifice', action.user, user);
        embed.description += ' and tells them to ';
        embed.description += global.dict.query('stfu', action.user, user);
        action.reply({ embeds: [ embed ] });
    },
};
