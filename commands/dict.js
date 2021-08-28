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
        level_remove: 2,
        level_mass: 4
    },
    buttons: {},
    getdict(action) {
        const word = action.options.getString('dictionary');
        global.dict.check(word);
        return word;
    },
    async execute(bot, action) {
        const func = action.options.getSubcommand(), level = global.access.level(action.guild, action.user);
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
                if (this.config.level_add > level) throw `Access level '${this.config.level_add}' is required.`;
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
                if (this.config.level_remove > level) throw `Access level '${this.config.level_remove}' is required.`;
                const word = this.getdict(action), str = action.options.getString('string'), list = global.dict.search(word, str);
                const embed = {
                    color: 0xff88ff,
                    title: `📕 Dictionary: ${word}`,
                    description: 'This will remove:',
                    fields: [],
                    footer: { text: '' }
                };
                const result = global.tools.embedfields(embed, list);
                if (result.page.num > 0) embed.footer.text += `[Page ${result.page.cur + 1} of ${result.page.num + 1}] Showing ${result.amount} of ${result.count} match(es).`;
                else embed.footer.text += `There are a total of ${result.count} match(es).`;
                if (result.count > 1 && level < this.config.level_mass) embed.footer.text += ` Level ${this.config.level_mass} required to remove more than one entry.`;

                const component = {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            label: 'OK',
                            style: 3,
                            custom_id: `dict ${action.id} ok`,
                            disabled: result.count > 1 && level < this.config.level_mass
                        },
                        {
                            type: 2,
                            label: 'Cancel',
                            style: 4,
                            custom_id: `dict ${action.id} cancel`,
                            disabled: false
                        },
                        {
                            type: 2,
                            label: '⏪',
                            style: 1,
                            custom_id: `dict ${action.id} prev`,
                            disabled: result.page.num > 0 ? false : true
                        },
                        {
                            type: 2,
                            label: '⏩',
                            style: 1,
                            custom_id: `dict ${action.id} next`,
                            disabled: result.page.num > 0 ? false : true
                        },
                    ]
                };
                this.buttons[action.id] = {
                    action: 'remove',
                    string: str,
                    user: action.user,
                    page: {
                        cur: 0,
                        num: result.page.num
                    },
                    word: word,
                    result: result,
                    list: list
                };
                action.reply({ embeds: [ embed ], components: [ component ] });
                break;
            }
            default: {
                throw `Invalid sub-command '${func}'. Valid commands are: ${global.tools.subcommands(this.config)}`;
            }
        }
    },
    async button(bot, action, id, op) {
        if (!this.buttons[id]) throw `No button interaction for message '${id}'.`;
        const button = this.buttons[id];
        if (action.user.id !== button.user.id) throw `You are not the author of message '${id}'.`;
        switch (button.action) {
            case 'remove': {
                const level = global.access.level(action.guild, action.user);
                const reply = {
                    content: '',
                    embeds: [{
                        color: 0xff88ff,
                        title: `📕 Dictionary: ${button.word}`,
                        description: 'ATTENTION! This will remove:',
                        fields: [],
                        footer: { text: '' }
                    }],
                    components: [{
                        type: 1,
                        components: [
                            {
                                type: 2,
                                label: 'OK',
                                style: 3,
                                custom_id: `dict ${id} ok`,
                                disabled: button.result.count > 1 && level < this.config.level_mass
                            },
                            {
                                type: 2,
                                label: 'Cancel',
                                style: 4,
                                custom_id: `dict ${id} cancel`,
                                disabled: false
                            },
                            {
                                type: 2,
                                label: '⏪',
                                style: 1,
                                custom_id: `dict ${id} prev`,
                                disabled: button.page.num > 0 ? false : true
                            },
                            {
                                type: 2,
                                label: '⏩',
                                style: 1,
                                custom_id: `dict ${id} next`,
                                disabled: button.page.num > 0 ? false : true
                            },
                        ]
                    }]
                };

                switch (op) {
                    case 'ok': {
                        if (button.result.count <= 1 || level >= this.config.level_mass) {
                            try {
                                const ret = global.dict.remove(button.word, button.list);
                                reply.embeds[0].color = 0x88ff88;
                                reply.embeds[0].description = `Successfully removed ${ret} of ${button.list.length} match(es):`;
                            }
                            catch (err) {
                                reply.embeds[0].color = 0xff8888;
                                reply.embeds[0].description = `Failed: ${err}`;
                            }
                            reply.components[0].components[0].disabled = reply.components[0].components[1].disabled = true;
                            break;
                        }
                        // fall-through
                    }
                    case 'cancel': {
                        reply.embeds[0].color = 0x8888ff;
                        reply.embeds[0].description = 'Remove cancelled. Results were:';
                        reply.components[0].components[0].disabled = reply.components[0].components[1].disabled = true;
                        break;
                    }
                    case 'prev': {
                        button.page.cur--;
                        if (button.page.cur < 0) button.page.cur = button.page.num;
                        break;
                    }
                    case 'next': {
                        button.page.cur++;
                        if (button.page.cur > button.page.num) button.page.cur = 0;
                        break;
                    }
                    default: throw `Invalid '${button.action}' interaction '${op}'`;
                }

                const result = global.tools.embedfields(reply.embeds[0], button.list, button.page.cur);
                if (result.page.num > 0) reply.embeds[0].footer.text += `[Page ${result.page.cur + 1} of ${result.page.num + 1}] Showing ${result.amount} of ${result.count} match(es).`;
                else reply.embeds[0].footer.text += `There are a total of ${result.count} match(es).`;
                if (result.count > 1 && level < this.config.level_mass) reply.embeds[0].footer.text += ` Level ${this.config.level_mass} required to remove more than one entry.`;

                action.update(reply);
                break;
            }
            default: throw `Invalid button interaction '${button.action}'.'`;
        }
    }
};
