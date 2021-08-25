module.exports = {
    config: {
        data: {
            name: 'ping',
            description: 'Replies with Pong!',
            options: []
        },
        level: 1
    },
    async execute(bot, action) {
        await action.reply({ content: 'Pong! You smell.' });
    },
};
