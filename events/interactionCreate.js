module.exports = {
    name: 'interactionCreate',
    execute(bot, action) {
        if (!action.user.bot && action.isCommand()) {
            const command = action.client.commands.get(action.commandName);
            if (command) {
                console.log(`${action.user.tag} in #${action.channel.name} executed command: ${action.commandName}`);
                command.execute(bot, action);
            }
            else {
                console.log(`${action.user.tag} in #${action.channel.name} sent invalid command: ${action.commandName}`);
                action.reply({ content: 'Invalid command!', ephemeral: true });
            }
        }
    },
};
