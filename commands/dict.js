module.exports = {
    config: {
        chat: {
            name: 'dict',
            description: 'Operate on the dictionaries.',
            options: [
                {
                    name: 'search',
                    description: 'Search for entries in dictionaries.',
                    type: 1,
                    options: [
                        {
                            type: 3,
                            name: 'dictionary',
                            description: 'Select dictionary.',
                            required: false,
                            choices: global.dict.choices()
                        },
                        {
                            type: 3,
                            name: 'string',
                            description: 'Select search string.',
                            required: false,
                            choices: undefined
                        }
                    ]
                }
            ]
        },
        level: 1
    },
    async execute(bot, action) {
        const command = action.options.getSubcommand();
        switch (command) {
            case 'search': {
                const dict = action.options.getString('dictionary');
                if (dict !== null && global.dict.list.find(value => value === dict)) {
                    const str = action.options.getString('string');
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
                break;
            }
            default: {
                let msg = `Sorry, there is no dictionary command **${command}**.\n`;
                msg += 'Valid commands are: **search**';
                await action.reply({
                    content: msg
                });
            }
        }
    },
};
