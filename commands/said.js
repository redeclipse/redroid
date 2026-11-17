module.exports = {
    config: {
        chat: {
            name: 'said',
            description: 'Shows how many times "that\'s what she/he said" has been said, on Discord and in game.'
        }
    },
    async execute(bot, action) {
        const count = global.stats.get('said');
        const embed = {
            color: 0x8888ff,
            description: `${global.emoji.icons('voices')}**That's What They Said**\nThey've said it a total of **${count}** ${count === 1 ? 'time' : 'times'}.`
        };
        await action.reply({ embeds: [ embed ] });
    },
};
