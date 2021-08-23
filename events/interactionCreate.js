module.exports = {
    name: 'interactionCreate',
    execute(bot, iact) {
        if (iact.isCommand()) {
            const command = iact.client.commands.get(iact.commandName);
            if (command) {
                console.log(`${iact.user.tag} in #${iact.channel.name} executed command: ${iact.commandName}`);
                command.execute(bot, iact);
            }
            else {
                console.log(`${iact.user.tag} in #${iact.channel.name} sent invalid command: ${iact.commandName}`);
                iact.reply({ content: 'Invalid command!', ephemeral: true });
            }
        }
    },
};
