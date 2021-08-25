const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    level: 1,
    data: new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Search for quotable moments.')
        .addStringOption(option => option.setName('target').setDescription('Select target.'))
        .addStringOption(option => option.setName('search').setDescription('Select search terms.')),
    async execute(bot, action) {
        /*
        <@!189189124194959361>
        if (typeof target !== 'undefined' && target !== null && target !== '') {
            const match = str.match(/^<@!(.*?)>$/);
            if (match) {
                const user = await action.client.users.cache(u => u.id === match[0]);
                target = user.username;
            }
        }
        */
        const target = action.options.getString('target');
        if (target.slice(0, 2) === '<@') {
            await action.reply({
                content: 'Sorry, searching by Discord ID is not yet supported. Try their IRC nickname?'
            });
        }
        else {
            const str = action.options.getString('search'), result = global.quote.query(target, str);
            if (result !== null && result !== '') {
                let msg = 'Quotes';
                if (typeof target !== 'undefined' && target !== null && target !== '') msg += ` by **${target}**`;
                if (typeof str !== 'undefined' && str !== null && str !== '') msg += ` matching **${str}**`;
                msg += ':\n';
                msg += '```';
                msg += '<' + result[0] + '> ' + result[1];
                msg += '```';
                await action.reply({
                    content: msg
                });
            }
            else {
                let msg = 'Sorry, there were no quotes';
                if (typeof target !== 'undefined' && target !== null && target !== '') msg += ` by **${target}**`;
                if (typeof str !== 'undefined' && str !== null && str !== '') msg += ` matching **${str}**`;
                msg += '.';
                await action.reply({
                    content: msg
                });
            }
        }
    },
};
