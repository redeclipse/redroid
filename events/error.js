const { Events } = require('discord.js');

module.exports = {
    name: Events.Error,
    once: false,
    execute(bot, error) {
        global.log.error(`ERROR: ${error.name} - ${error.message}`);
    },
};
