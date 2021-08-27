module.exports = {
    config: {
        chat: {
            name: 'faq',
            description: 'Search for quotable moments.',
            options: [
                {
                    type: 3,
                    name: 'target',
                    description: 'Select target.',
                    required: false,
                    choices: undefined
                },
                {
                    type: 3,
                    name: 'search',
                    description: 'Select search terms.',
                    required: false,
                    choices: undefined
                }
            ]
        },
        level: 1
    },
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
        const str = action.options.getString('search'), results = global.faq.query(target, str);
        if (results !== null && results !== '' && results[1].length > 0) {
            let msg = '';
            if (typeof target !== 'undefined' && target !== null && target !== '') msg += 'FAQ for **\'' + results[0] + '**\'';
            else msg += 'Randomly chosen FAQ, **\'' + results[0] + '\'**';
            if (typeof str !== 'undefined' && str !== null && str !== '') msg += `, with instances of **'${str}'**`;
            msg += ':\n';
            let carry = 0, count = 0, more = 0, output = '';
            for (const result of results[1]) {
                const idx = count + 1, iter = `${idx}. ${result}\n`, total = iter.length + output.length;
                if (total < 1000 && carry < 20) {
                    output += iter;
                    carry++;
                }
                else { more++; }
                count++;
            }
            if (output.length > 0) {
                msg += '```\n';
                msg += output;
                msg += '```';
            }
            if (more) msg += `Results truncated, showing **${carry}** of **${count}** match(es).`;
            await action.reply({
                content: msg
            });
        }
        else {
            let msg = 'Sorry, there were no FAQs';
            if (typeof target !== 'undefined' && target !== null && target !== '') msg += ` for **${target}**`;
            if (typeof str !== 'undefined' && str !== null && str !== '') msg += ` matching **'${str}'**`;
            msg += '.';
            await action.reply({
                content: msg
            });
        }
    },
};
