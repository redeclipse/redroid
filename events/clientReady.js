const { ActivityType, Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: false,
    async execute(bot, client) {
        bot.online = true;

        const title = `${client.user.tag} <@${client.user.id}>`;
        process.title = title;
        process.stdout.write(`\u001B]0;${title}\u0007`);

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
    },
};
