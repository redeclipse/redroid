const { Events } = require('discord.js');

// Only emitted for close codes discord.js will not recover from (bad token, disallowed intents, ...),
// so shut down rather than restart into the same failure
module.exports = {
    name: Events.ShardDisconnect,
    once: false,
    execute(bot, event, shardid) {
        bot.online = false;
        if (event.code === 4004) global.log.error('Failed to authenticate with Discord.');
        else global.log.error(`Shard ${shardid} disconnected from Discord with unrecoverable code ${event.code}.`);
        bot.shutdown();
    }
};
