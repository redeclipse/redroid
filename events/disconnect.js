module.exports = {
    name: 'disconnect',
    once: true,
    execute(bot, event) {
        if (event.code === 1000) {
            console.log('Disconnected from Discord cleanly.');
        }
        else if (event.code === 4004) {
            console.error('Failed to authenticate with Discord.');
            return bot.shutdown(false);
        }
        else {
            console.warn(`Disconnected from Discord with code ${event.code}.`);
        }

        bot.shutdown();
    }
};
