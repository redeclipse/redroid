const { ApplicationCommandOptionType, MessageFlags } = require('discord.js');

// The Ready queue from Discord: where you stand, and the Matchmaking thread's buttons, which answer only the member who pressed them
module.exports = {
    config: {
        chat: {
            name: 'matchmaking',
            description: 'The Ready queue, which sends everyone waiting to a server together once there are enough.',
            options: [
                {
                    name: 'status',
                    description: 'Where you stand in the Ready queue.',
                    type: ApplicationCommandOptionType.Subcommand
                }
            ]
        }
    },
    async execute(bot, action) {
        if (!global.matchmaking || !global.matchmaking.bot) throw 'Matchmaking isn\'t running.';
        await action.reply({ content: global.matchmaking.status(action.user.id), flags: MessageFlags.Ephemeral });
    },
    async button(bot, action, id, op) {
        const mm = global.matchmaking;
        if (!mm || !mm.bot) throw 'Matchmaking isn\'t running.';
        if (global.access.level(action.guild, action.user) < 0) throw 'You can\'t use the Ready queue.';
        // the master can take a moment, and an unanswered button fails after 3 seconds
        await action.deferReply({ flags: MessageFlags.Ephemeral });
        let content;
        switch (op) {
            case 'join': {
                // channel:threshold, from the row the button is in
                const [channel, size] = id.split(':'), threshold = Number(size);
                if (!mm.thresholds.includes(threshold)) throw 'That isn\'t a match size.';
                if (!mm.channels().some(c => c.name === channel)) throw 'That queue isn\'t open any more.';
                content = await mm.join(action.user.id, channel, threshold);
                break;
            }
            case 'leave':
                content = await mm.leave(action.user.id);
                break;
            case 'renew':
                if (id !== action.user.id) throw 'That reminder is for someone else.';
                content = await mm.renew(action.user.id);
                break;
            default:
                throw 'Unknown button.';
        }
        await action.editReply({ content });
    }
};
