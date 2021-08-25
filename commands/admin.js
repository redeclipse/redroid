const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    level: 5,
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Perform an administrative function.')
        .addStringOption(option => option.setName('function').setDescription('Select a function.')),
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
