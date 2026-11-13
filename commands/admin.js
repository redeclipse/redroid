const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'admin',
            description: 'Perform an administrative function.',
            options: [
                {
                    name: 'restart',
                    description: 'Restarts the bot.',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'shutdown',
                    description: 'Shuts down the bot.',
                    type: ApplicationCommandOptionType.Subcommand
                }
            ]
        }
    },
    async execute(bot, action) {
        const func = action.options.getSubcommand();
        switch (func) {
            case 'restart': {
                await action.reply({
                    content: 'Okay, restarting...'
                });
                action.client.shutdown(true);
                break;
            }
            case 'shutdown': {
                await action.reply({
                    content: 'Okay, shutting down...'
                });
                action.client.shutdown();
                break;
            }
            default: {
                throw `Invalid sub-command '${func}'. Valid commands are: ${global.tools.subcommands(this.config)}`;
            }
        }
    },
};
