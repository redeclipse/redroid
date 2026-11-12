const { Events, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    // Separate run function so we can throw errors
    async run(bot, action) {
        if (action.user.bot) return;
        const where = action.channel ? `#${action.channel.name}` : 'DM';
        if (action.isButton()) {
            const args = action.customId.match(/^([^ ]*) ([^ ]*) (.*)$/);
            if (!args || args.length < 4) throw 'Insufficient button arguments.';
            const command = bot.commands.get(args[1]);
            if (!command || typeof command.button === 'undefined') throw 'Invalid command.';
            await command.button(bot, action, args[2], args[3]);
        }
        else if (action.isChatInputCommand() || action.isContextMenuCommand()) {
            const command = bot.commands.get(action.commandName);
            if (!command) {
                global.log.audit(`${action.user.tag} in ${where} sent invalid command: ${action.commandName}`);
                throw 'Command not found.';
            }
            const data = action.isChatInputCommand() ? command.config.chat : action.isUserContextMenuCommand() ? command.config.user : command.config.mesg;
            if (command.config.level && command.config.level > global.access.level(action.guild, action.user)) {
                global.log.audit(`${action.user.tag} in ${where} failed command: ${data.name} (Level ${command.config.level} required)`);
                throw `Access level '${command.config.level}' is required.`;
            }
            global.log.audit(`${action.user.tag} in ${where} executed command '${data.name}'`);
            await command.execute(bot, action);
        }
        else if (action.isRepliable()) { throw 'Invalid interaction type.'; }
    },
    async execute(bot, action) {
        try { await this.run(bot, action); }
        catch (err) {
            // Programming errors go to the log; thrown strings are messages for the user
            if (err instanceof Error) global.log.error(`Interaction failed: ${err.stack || err}`);
            const embed = {
                color: 0xff8888,
                title: '⚠ Command Failed',
                description: err instanceof Error ? 'An internal error occurred.' : String(err)
            };
            try {
                if (action.replied || action.deferred) await action.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                else if (action.isButton()) await action.update({ embeds: [embed], components: [] });
                else await action.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
            catch (e) {
                global.log.error(`Failed to report interaction error: ${e.message}`);
            }
        }
    },
};
