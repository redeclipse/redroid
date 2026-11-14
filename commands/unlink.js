const { MessageFlags } = require('discord.js');

// Unlinks your Discord account from your Red Eclipse account
module.exports = {
    config: {
        chat: {
            name: 'unlink',
            description: 'Unlink your Discord account from your Red Eclipse account.'
        }
    },
    async execute(bot, action) {
        await action.deferReply({ flags: MessageFlags.Ephemeral });
        const done = await global.accounts.unlink(action.user.id);
        if (done) global.log.audit(`Accounts: ${action.user.tag} unlinked their Red Eclipse account`);
        await action.editReply({ content: done ? 'Unlinked from your Red Eclipse account.' : 'Your Discord account isn\'t linked to a Red Eclipse account.' });
    }
};
