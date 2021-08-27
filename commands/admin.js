module.exports = {
    config: {
        chat: {
            name: 'admin',
            description: 'Perform an administrative function.',
            options: [
                {
                    type: 3,
                    name: 'function',
                    description: 'Select a function.',
                    required: false,
                    choices: undefined
                }
            ]
        },
        level: 5
    },
    async execute(bot, action) {
        const func = action.options.getString('function');
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
                let msg = 'Sorry, ';
                if (func !== null) msg += `there is no administrative function called **${func}**.`;
                else msg += 'you need to specify a administrative function.';
                msg += '\n';
                msg += 'Valid functions are: **restart, shutdown**';
                await action.reply({
                    content: msg
                });
                break;
            }
        }
    },
};
