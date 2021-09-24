module.exports = {
    name: 'invalidated',
    once: false,
    execute(bot) {
        bot.shutdown(true);
    },
};
