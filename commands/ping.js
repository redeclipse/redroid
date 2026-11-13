module.exports = {
    config: {
        chat: {
            name: 'ping',
            description: 'Replies with Pong!',
            options: []
        }
    },
    async execute(bot, action) {
        await action.reply({ content: 'Pong! You smell.' });
    },
};
