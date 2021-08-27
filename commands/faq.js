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
                    choices: null
                },
                {
                    type: 3,
                    name: 'search',
                    description: 'Select search terms.',
                    required: false,
                    choices: null
                }
            ]
        },
        level: 1
    },
    execute(bot, action) {
        const target = action.options.getString('target'), str = action.options.getString('search'), results = global.faq.query(target, str);
        if (!results || !results[1].length) {
            let msg = 'There are no FAQs';
            if (target) msg += ` for '${target}''`;
            if (str) msg += ` matching '${str}'`;
            msg += '.';
            throw msg;
        }

        let msg = '';
        if (target) msg += 'FAQ for \'' + results[0] + '\'';
        else msg += 'Randomly chosen FAQ, \'' + results[0] + '\'';
        if (str) msg += `, with instances of '${str}'`;
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
        if (more) msg += `Results truncated, showing ${carry} of ${count} match(es).`;

        action.reply({ content: msg });
    },
};
