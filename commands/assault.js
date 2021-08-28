module.exports = {
    config: {
        chat: {
            name: 'assault',
            description: 'Assaults someone: <bot> {assault} <user> {action} using {object}',
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
            name: 'Assault',
            type: 2
        },
        level: 1,
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
        action.reply({ embeds: [ embed ] });
    },
};
