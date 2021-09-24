module.exports = {
    name: 'ready',
    once: false,
    execute(bot, client) {
        bot.online = true;

        (title => {
            process.title = title;
            process.stdout.write(`\u001B]0;${title}\u0007`);
        })(`${client.user.username}#${client.user.discriminator} <@${client.user.id}>`);

        global.log.out(`Ready: ${client.user.username}#${client.user.discriminator} <@${client.user.id}>`);

        // client.user.setAFK(true);
        client.user.setStatus('online');
        client.user.setActivity({
            type: 'WATCHING',
            name: 'everything you do..'
        });
    },
};
