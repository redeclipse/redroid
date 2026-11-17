const { Events } = require('discord.js');

// "That's what X said", X being one to three words, with or without the apostrophe
const SAID = /\bthat['’`]?s\s+what\s+(?:\S+\s+){1,3}?said\b/i;

// The Said count: each "That's what X said" on Discord or in game adds one and is announced with a line, at most once a cooldown
module.exports = {
    name: 'said',
    bot: null,
    last: 0,
    start(bot) {
        this.bot = bot;
        bot.on(Events.MessageCreate, message => this.message(message).catch(err => global.log.error(`Said: ${err.stack || err}`)));
        return false;
    },
    // The line announcing one more, or null when the text doesn't say it or the cooldown hasn't passed
    heard(text) {
        if (!text || !SAID.test(text)) return null;
        const now = Date.now();
        if (now - this.last < global.stats.config.said_cooldown) return null;
        this.last = now;
        const count = global.stats.inc('said'), mile = global.stats.milestone(count, 'time they said it');
        const line = n => `That's what they said: ${n} ${count === 1 ? 'time' : 'times'}.${mile ? ` ${mile}` : ''}`;
        return { discord: line(`**${count}**`), game: line(count) };
    },
    // Anywhere on Discord but the bot's own channels; the bridge's threads are counted by the bridge, which sends them on to the game
    async message(message) {
        if (!message.guild || message.guild.id !== this.bot.config.guildId) return;
        if (message.author.bot || message.webhookId || message.system) return;
        const channels = this.bot.config.channels, chan = message.channel;
        if ([channels.log, channels.audit, channels.findplayers].includes(message.channelId)) return;
        if (global.bridge && global.bridge.forum && chan && chan.parentId === global.bridge.forum.id) return;
        if (global.matchmaking && global.matchmaking.data && message.channelId === global.matchmaking.data.thread) return;
        const level = this.bot.config.levels.said; // missing, it is refused for everyone, as the command is
        if (typeof level !== 'number' || global.access.level(message.guild, message.author) < level) return;
        const said = this.heard(message.content);
        if (said) await message.reply({ content: said.discord, allowedMentions: { parse: [] } });
    }
};
