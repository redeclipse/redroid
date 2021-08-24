const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    level: 1,
    data: new SlashCommandBuilder()
        .setName('dict')
        .setDescription('Search, add or delete entries in the command dictionaries.')
        .addStringOption(option => option.setName('dictionary').setDescription('Select dictionary.'))
        .addStringOption(option => option.setName('operation').setDescription('Select operation.'))
        .addStringOption(option => option.setName('string').setDescription('Select operational string.')),
    async execute(bot, action) {
        const dict = action.options.getString('dictionary');
        if (dict !== null && global.dict.list.find(value => value === dict)) {
            const op = action.options.getString('operation');
            switch (op) {
                case 'search': {
                    const str = action.options.getString('string'), list = global.dict.search(dict, str);
                    console.log(JSON.stringify(list, null, 2));
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
                    break;
                }
                default: {
                    let msg = `Sorry, <@${action.user.id}>, there is no dictionary operation **'${op}'**.`;
                    msg += 'Valid operations are: **search**';
                    await action.reply({
                        content: msg
                    });
                }
            }
        }
        else {
            let msg = `Sorry, <@${action.user.id}>, `, comma = false;
            if (dict !== null) msg += `there is no dictionary called **'${dict}'**.`;
            else msg += 'you need to specify a dictionary.';
            msg += '\n';
            msg += 'Valid dictionaries are: **';
            for (const word of global.dict.list) {
                if (comma) msg += ', ';
                msg += word;
                comma = true;
            }
            msg += '**';
            await action.reply({
                content: msg
            });
        }
    },
};
