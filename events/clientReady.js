const { ActivityType, Events, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: false,
    async execute(bot, client) {
        bot.online = true;

        const title = `${client.user.tag} <@${client.user.id}>`;
        process.title = title;
        // Terminal title escape; under pm2 stdout is a log file
        if (process.stdout.isTTY) process.stdout.write(`\u001B]0;${title}\u0007`);

        global.log.audit(`Ready: ${title}`);

        client.user.setPresence({
            status: 'online',
            activities: [{ type: ActivityType.Watching, name: 'everything you do..' }]
        });

        const guilds = await client.guilds.fetch();
        for (const partial of guilds.values()) {
            const guild = await partial.fetch();
            await Promise.all([guild.channels.fetch(), guild.members.fetch(), guild.emojis.fetch()]);
        }

        this.checkchannels(bot, client);
    },
    // Sends to a missing channel are silently skipped, so report bad config.channels entries once at startup
    checkchannels(bot, client) {
        for (const [key, id] of Object.entries(bot.config.channels || {})) {
            const chan = client.channels.cache.get(id);
            if (!chan) {
                global.log.warn(`Channel '${key}' (${id}) from config.json was not found.`);
                continue;
            }
            const perms = chan.permissionsFor ? chan.permissionsFor(client.user) : null;
            if (!perms || !perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
                global.log.warn(`Channel '${key}' (#${chan.name}) from config.json is not writable by the bot.`);
            }
        }
    },
};
