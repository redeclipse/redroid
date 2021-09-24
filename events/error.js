module.exports = {
    name: 'error',
    once: false,
    execute(bot, error) {
        global.log.error(`ERROR: ${error.name} - ${error.message}`);
    },
};
