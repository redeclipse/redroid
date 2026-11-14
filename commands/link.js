const { ApplicationCommandOptionType, MessageFlags, escapeMarkdown } = require('discord.js');

// Links your Discord account to your Red Eclipse account, with a code from the website's account page or the game
module.exports = {
    config: {
        chat: {
            name: 'link',
            description: 'Link your Red Eclipse account, with a code from the website\'s account page or the game.',
            options: [
                {
                    name: 'code',
                    description: 'The 8 letter code, which lasts ten minutes.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    min_length: 8,
                    max_length: 8
                }
            ]
        }
    },
    async execute(bot, action) {
        await action.deferReply({ flags: MessageFlags.Ephemeral });
        const name = (action.member && action.member.displayName) || action.user.globalName || action.user.username;
        const linked = await global.accounts.link(action.user.id, name, action.options.getString('code'));
        global.log.audit(`Accounts: ${action.user.tag} linked the Red Eclipse account ${linked.handle}`);
        await action.editReply({ content: `Linked to your Red Eclipse account **${escapeMarkdown(linked.handle)}**.` });
    }
};
