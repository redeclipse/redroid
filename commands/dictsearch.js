const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    level: 1,
    data: new SlashCommandBuilder()
        .setName('dictsearch')
        .setDescription('Search for entries in dictionaries.')
        .addStringOption(option => option.setName('dictionary').setDescription('Select dictionary.'))
        .addStringOption(option => option.setName('search').setDescription('Select search terms.')),
    async execute(bot, action) {
        const dict = action.options.getString('dictionary');
        if (dict !== null && global.dict.list.find(value => value === dict)) {
            const str = action.options.getString('search');
            if (str) {
                const list = global.dict.search(dict, str);
                if (list.length) {
                    let msg = `Dictionary search results for **${str}** in **${dict}**:\n`,
                        carry = 0, count = 0, more = 0, output = '';
                    for (const result of list) {
                        const iter = `${result}\n`, total = iter.length + output.length;
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
                    else msg += `There were a total of **${count}** match(es).`;
                    await action.reply({
                        content: msg
                    });
                }
                else {
                    await action.reply({
                        content: `There are no dictionary matches for **${str}** in **${dict}**.`
                    });
                }
            }
            else {
                await action.reply({
                    content: 'Sorry, you need to provide a search term.'
                });
            }
        }
        else {
            let msg = 'Sorry, ';
            if (dict !== null) msg += `there is no dictionary called **${dict}**.`;
            else msg += 'you need to specify a dictionary.';
            msg += '\n';
            msg += 'Valid dictionaries are: **' + global.dict.print() + '**';
            await action.reply({
                content: msg
            });
        }
    },
};
