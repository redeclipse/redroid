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
        level: 1,
        level_add: 2,
        level_remove: 2
    },
    getdict(action) {
        const word = action.options.getString('dictionary');
        global.dict.check(word);
        return word;
    },
    async execute(bot, action) {
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
                    const result = global.tools.embedfields(embed, list);
                    if (result.more) embed.footer.text += `Results truncated, showing ${result.amount} of ${result.count} match(es).`;
                    else embed.footer.text += `There are a total of ${result.count} match(es).`;
                    action.reply({
                        embeds: [embed]
                    });
                }
                else { throw `There are no dictionary matches in '${word}' for '${str}'.`; }
                break;
            }
            case 'add': {
                if (this.config.level_add > global.access.level(action.guild, action.user)) throw `Access level '${this.config.level_add}' is required.`;
                const word = this.getdict(action), str = action.options.getString('string'), ret = global.dict.add(word, str);
                action.reply({
                    embeds: [{
                        color: 0x8888ff,
                        title: `📕 Dictionary: ${word}`,
                        description: `Added: ${ret}`
                    }]
                });
                break;
            }
            case 'remove': {
                if (this.config.level_remove > global.access.level(action.guild, action.user)) throw `Access level '${this.config.level_remove}' is required.`;
                const word = this.getdict(action), str = action.options.getString('string'), list = global.dict.remove(word, str);
                const embed = {
                    color: 0x8888ff,
                    title: `📕 Dictionary: ${word}`,
                    description: 'Removed:',
                    fields: [],
                    footer: { text: '' }
                };
                const result = global.tools.embedfields(embed, list);
                if (result.more) embed.footer.text += `Results truncated, showing ${result.amount} of ${result.count} removal(s).`;
                else embed.footer.text += `There were a total of ${result.count} removal(s).`;
                action.reply({ embeds: [ embed ] });
                break;
            }
            default: {
                throw `Invalid sub-command '${func}'. Valid commands are: ${global.tools.subcommands(this.config)}`;
            }
        }
    },
};
