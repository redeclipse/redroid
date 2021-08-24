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
                    content: `Okay, <@${action.user.id}>, restarting...`
                });
                action.client.shutdown(true);
                break;
            }
            case 'shutdown': {
                await action.reply({
                    content: `Okay, <@${action.user.id}>, shutting down...`
                });
                action.client.shutdown();
                break;
            }
            default: {
                let msg = `Sorry, <@${action.user.id}>, `;
                if (func !== null) msg += `there is no function called **'${func}'**.`;
                else msg += 'you need to specify a function.';
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
