module.exports = {
    name: 'ready',
    once: true,
    execute(bot, client) {
        client.user.setAFK(true);

        (title => {
            process.title = title;
            process.stdout.write(`\u001B]0;${title}\u0007`);
        })(`${client.user.username}#${client.user.discriminator} <@${client.user.id}>`);

        let msg = 'Ready:\n';
        msg += ` - User: ${client.user.username}#${client.user.discriminator} <@${client.user.id}>\n`;
        msg += ` - Users: ${client.users.cache.filter(user => !user.bot).size}\n`;
        msg += ` - Bots: ${client.users.cache.filter(user => user.bot).size}\n`;
        msg += ` - Channels: ${client.channels.cache.size}\n`;
        msg += ` - Guilds: ${client.guilds.cache.size}`;
        console.log(msg);

        client.loaded = true;
    },
};
