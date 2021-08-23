module.exports = {
    name: 'interactionCreate',
    execute(interaction) {
        console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered an interaction.`);
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (command) {
                console.log(`${interaction.user.tag} in #${interaction.channel.name} executed command: ${interaction.commandName}`);
                command.execute(interaction);
            }
            else {
                console.log(`${interaction.user.tag} in #${interaction.channel.name} sent invalid command: ${interaction.commandName}`);
                interaction.reply({ content: 'Invalid command!', ephemeral: true });
            }
        }
    },
};
