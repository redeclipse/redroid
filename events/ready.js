module.exports = {
    name: 'ready',
    once: true,
    execute(bot, client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
    },
};
