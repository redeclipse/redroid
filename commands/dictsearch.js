const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    level: 1,
    data: new SlashCommandBuilder()
        .setName('dictsearch')
        .setDescription('Search for entries in dictionaries.')
        .addStringOption(option => option.setName('dictionary').setDescription('Select dictionary.').setRequired(true))
        .addStringOption(option => option.setName('search').setDescription('Select search terms.').setRequired(true)),
    async execute(bot, action) {
        const dict = action.options.getString('dictionary');
        if (dict !== null && global.dict.list.find(value => value === dict)) {
            const str = action.options.getString('search'), list = global.dict.search(dict, str);
            if (list.length) {
                let msg = `<@${action.user.id}>, dictionary search results for **'${str}'** in **'${dict}'**:\n`,
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
                    content: `<@${action.user.id}>, there are no dictionary matches for **'${str}'** in **'${dict}'**.`
                });
            }
        }
        else {
            let msg = `Sorry, <@${action.user.id}>, `;
            if (dict !== null) msg += `there is no dictionary called **'${dict}'**.`;
            else msg += 'you need to specify a dictionary.';
            msg += '\n';
            msg += 'Valid dictionaries are: **' + global.dict.print() + '**';
            await action.reply({
                content: msg
            });
        }
    },
};
