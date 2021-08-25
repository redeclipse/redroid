module.exports = {
    name: 'interactionCreate',
    execute(bot, action) {
        if (!action.user.bot && action.isCommand()) {
            const command = bot.commands.get(action.commandName);
            if (command) {
                const level = global.access.level(action.guild, action.user);
                if (command.config.level !== undefined && command.config.level !== null && command.config.level > level) {
                    console.log(`${action.user.tag} in #${action.channel.name} failed command: ${command.config.data.name} (Level ${command.config.level} > ${level})`);
                    action.reply({ content: `Sorry, you need level **${command.config.level}** to execute **${command.config.data.name}**, but your level is **${level}**.` });
                }
                else {
                    console.log(`${action.user.tag} in #${action.channel.name} executed command: ${command.config.data.name}`);
                    command.execute(bot, action);
                }
            }
            else {
                console.log(`${action.user.tag} in #${action.channel.name} sent invalid command: ${action.commandName}`);
                action.reply({ content: `Sorry, there is no such command called **${action.commandName}**` });
            }
        }
    },
};
