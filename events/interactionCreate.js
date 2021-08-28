module.exports = {
    name: 'interactionCreate',
    // Separate run function so we can throw errors
    async run(bot, action) {
        if (action.user.bot) return;
        if (!action.isCommand() && !action.isContextMenu()) throw 'Invalid interaction type.';
        const command = bot.commands.get(action.commandName), data = action.isCommand() ? command.config.chat : command.config.user;
        if (!command) {
            global.log.out(`${action.user.tag} in #${action.channel.name} sent invalid command: ${action.commandName}`);
            throw 'Command not found.';
        }
        if (command.config.level && command.config.level > global.access.level(action.guild, action.user)) {
            global.log.out(`${action.user.tag} in #${action.channel.name} failed command: ${data.name} (Level ${command.config.level} required)`);
            throw `Access level '${command.config.level}' is required.`;
        }
        global.log.out(`${action.user.tag} in #${action.channel.name} executed command '${data.name}'`);
        await command.execute(bot, action);
    },
    async execute(bot, action) {
        try { await this.run(bot, action); }
        catch (err) {
            action.reply({
                embeds: [{
                    color: 0xff8888,
                    title: '⚠ Command Failed',
                    description: err
                }],
                ephemeral: true
            });
        }
    },
};
