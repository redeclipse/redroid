module.exports = {
    name: 'interactionCreate',
    execute(bot, action) {
        if (action.user.bot) return;
        if (!action.isCommand() && !action.isContextMenu()) {
            action.reply({ content: 'Sorry, the command failed: Invalid interaction type' });
            return;
        }
        const command = bot.commands.get(action.commandName), data = action.isCommand() ? command.config.chat : command.config.user;
        if (command) {
            const level = global.access.level(action.guild, action.user);
            if (command.config.level && command.config.level > level) {
                global.log.out(`${action.user.tag} in #${action.channel.name} failed command: ${data.name} (Level ${command.config.level} > ${level})`);
                action.reply({ content: `Sorry, you need level ${command.config.level} to execute '${data.name}'', but your level is ${level}.` });
            }
            else {
                global.log.out(`${action.user.tag} in #${action.channel.name} executed command '${data.name}'`);
                try { command.execute(bot, action); }
                catch (err) { action.reply({ content: `Sorry, the command failed: ${err}` }); }
            }
        }
        else {
            global.log.out(`${action.user.tag} in #${action.channel.name} sent invalid command: ${action.commandName}`);
            action.reply({ content: `Sorry, there is no such command called '${action.commandName}'` });
        }
    },
};
