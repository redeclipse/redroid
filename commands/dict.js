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
                    description: 'Add entries to dictionaries.',
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
                    description: 'Remove entries from dictionaries.',
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
                    const embed = {
                        color: 0x8888ff,
                        title: `📕 Dictionary: ${word}`,
                        description: `Searching for: **${str}**`,
                        fields: [],
                        footer: { text: '' }
                    };
                    let count = 0, more = 0;
                    for (const result in list) {
                        if (embed.fields.length >= 24) { more++; }
                        else {
                            const index = parseInt(result, 10) + 1;
                            embed.fields.push({ name: `[${index}]`, value: list[result], inline: true });
                        }
                        count++;
                    }
                    if (more) embed.footer.text += `Results truncated, showing ${embed.fields.length} of ${count} match(es).`;
                    else embed.footer.text += `There are a total of ${count} match(es).`;
                    action.reply({
                        embeds: [embed]
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
