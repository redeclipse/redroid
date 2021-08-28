module.exports = {
    config: {
        chat: {
            name: 'ping',
            description: 'Replies with Pong!',
            options: []
        },
        level: 1
    },
    async execute(bot, action) {
        action.reply({ content: 'Pong! You smell.' });
    },
};
