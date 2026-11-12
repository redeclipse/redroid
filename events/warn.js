const { Events } = require('discord.js');

module.exports = {
    name: Events.Warn,
    once: false,
    execute(bot, warning) {
        global.log.warn(`WARNING: ${warning}`);
    },
};
