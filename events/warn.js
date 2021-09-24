module.exports = {
    name: 'warn',
    once: false,
    execute(bot, warning) {
        global.log.wrn(`WARNING: ${warning}`);
    },
};
