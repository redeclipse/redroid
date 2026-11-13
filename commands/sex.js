const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'sex',
            description: 'Performs a questionable act: <bot> {sex}',
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
        const randmember = action.guild.members.cache.filter(m => m.user.id !== user.id).random();
        const randuser = randmember ? randmember.user : action.user;
        const count = global.stats.inc('sex'), mile = global.stats.milestone(count, 'sexual encounter');
        const embed = {
            color: 0x8888ff,
            title: '🍆 Sex',
            description: `<@${bot.user.id}> ${global.dict.query('sex', action.user, user, null, randuser)}`
        };
        if (mile) embed.footer = { text: mile };
        await action.reply({ embeds: [ embed ] });
    },
};
