module.exports = {
    name: 'disconnect',
    once: true,
    execute(bot, event) {
        this.online = false;
        if (event.code === 1000) {
            global.log.out('Disconnected from Discord cleanly.');
        }
        else if (event.code === 4004) {
            global.log.error('Failed to authenticate with Discord.');
        }
        else {
            global.log.warn(`Disconnected from Discord with code ${event.code}.`);
        }
        bot.shutdown(true);
    }
};
