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
                            required: true,
                            choices: global.dict.choices()
                        },
                        {
                            type: 3,
                            name: 'string',
                            description: 'Select search string.',
                            required: true,
                            choices: null
                        }
                    ]
                },
                {
                    name: 'add',
                    description: 'Add entries in dictionaries.',
                    type: 1,
                    options: [
                        {
                            type: 3,
                            name: 'dictionary',
                            description: 'Select dictionary.',
                            required: true,
                            choices: global.dict.choices()
                        },
                        {
                            type: 3,
                            name: 'string',
                            description: 'String to add.',
                            required: true,
                            choices: null
                        }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Search for entries in dictionaries.',
                    type: 1,
                    options: [
                        {
                            type: 3,
                            name: 'dictionary',
                            description: 'Select dictionary.',
                            required: true,
                            choices: global.dict.choices()
                        },
                        {
                            type: 3,
                            name: 'string',
                            description: 'Select search string.',
                            required: true,
                            choices: null
                        }
                    ]
                },
            ]
        },
        level: 1
    },
    getdict(action) {
        const word = action.options.getString('dictionary');
        global.dict.check(word);
        return word;
    },
    execute(bot, action) {
        const func = action.options.getSubcommand();
        switch (func) {
            case 'search': {
                const word = this.getdict(action), str = action.options.getString('string'), list = global.dict.search(word, str);
                if (list.length) {
                    let msg = `Dictionary search results in '${word}' for '${str}':\n`,
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
                    if (more) msg += `Results truncated, showing ${carry} of ${count} match(es).`;
                    else msg += `There are a total of ${count} match(es).`;
                    action.reply({
                        content: msg
                    });
                }
                else { throw `There are no dictionary matches in '${word}' for '${str}'.`; }
                break;
            }
            case 'add': {
                const word = this.getdict(action), str = action.options.getString('string'), ret = global.dict.add(word, str);
                action.reply({ content: `Okay, added to the '${word}' dictionary: ${ret}` });
                break;
            }
            case 'remove': {
                const word = this.getdict(action), str = action.options.getString('string'), ret = global.dict.remove(word, str);
                let msg = `Okay, removed from the '${word}' dictionary:`;
                if (ret.length > 1) {
                    msg += '\n```\n';
                    for (const value in ret) {
                        msg += `${value}\n`;
                    }
                    msg += '```';
                }
                else { msg += ` ${ret}`; }
                action.reply({ content: msg });
                break;
            }
            default: {
                throw `Invalid sub-command '${func}'. Valid commands are: ${global.tools.subcommands(this.config)}`;
            }
        }
    },
};
