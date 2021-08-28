module.exports = {
    config: {
        chat: {
            name: 'admin',
            description: 'Perform an administrative function.',
            options: [
                {
                    name: 'restart',
                    description: 'Restarts the bot.',
                    type: 1
                },
                {
                    name: 'shutdown',
                    description: 'Shuts down the bot.',
                    type: 1
                }
            ]
        },
        level: 5
    },
    async execute(bot, action) {
        const func = action.options.getSubcommand();
        switch (func) {
            case 'restart': {
                action.reply({
                    content: 'Okay, restarting...'
                });
                action.client.shutdown(true);
                break;
            }
            case 'shutdown': {
                action.reply({
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
