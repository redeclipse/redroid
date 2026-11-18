const { ApplicationCommandOptionType, escapeMarkdown } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'dict',
            description: 'Operate on the dictionaries.',
            options: [
                {
                    name: 'search',
                    description: 'Search for entries in dictionaries.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'dictionary',
                            description: 'Select dictionary.',
                            required: true,
                            choices: global.dict.choices()
                        },
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'string',
                            description: 'Select search string.',
                            required: true
                        }
                    ]
                },
                {
                    name: 'add',
                    description: 'Add entries to dictionaries.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'dictionary',
                            description: 'Select dictionary.',
                            required: true,
                            choices: global.dict.choices()
                        },
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'string',
                            description: 'String to add.',
                            required: true,
                            max_length: 1024
                        }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Remove entries from dictionaries.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'dictionary',
                            description: 'Select dictionary.',
                            required: true,
                            choices: global.dict.choices()
                        },
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'string',
                            description: 'Select search string.',
                            required: true
                        }
                    ]
                },
            ]
        },
    },
    getdict(action) {
        const word = action.options.getString('dictionary');
        global.dict.check(word);
        return word;
    },
    async execute(bot, action) {
        const func = action.options.getSubcommand(), level = global.access.level(action.guild, action.user);
        switch (func) {
            case 'search': {
                const word = this.getdict(action), str = action.options.getString('string'), list = global.dict.search(word, str, level);
                if (list.length) {
                    const embed = {
                        color: 0x8888ff,
                        description: `${global.emoji.icons('menu')}**Dictionary: ${word}**\nSearching for: **${escapeMarkdown(str)}**`,
                        fields: [],
                        footer: { text: '' }
                    };
                    const result = global.tools.embedfields(embed, list);
                    if (result.more) embed.footer.text += `Results truncated, showing ${result.amount} of ${result.count} match(es).`;
                    else embed.footer.text += `There are a total of ${result.count} match(es).`;
                    await action.reply({
                        embeds: [embed]
                    });
                }
                else { throw `There are no dictionary matches in '${word}' for '${escapeMarkdown(str)}'.`; }
                break;
            }
            case 'add': {
                if (global.dict.config.level_add > level) throw `Access level '${global.dict.config.level_add}' is required.`;
                const word = this.getdict(action), str = action.options.getString('string'), ret = global.dict.add(word, str);
                global.log.audit(`${action.user.tag} added to dictionary '${word}': ${escapeMarkdown(ret.slice(0, 200))}`);
                await action.reply({
                    embeds: [{
                        color: 0x8888ff,
                        description: `${global.emoji.icons('menu')}**Dictionary: ${word}**\nAdded: ${ret}`
                    }]
                });
                break;
            }
            case 'remove': {
                const cfg = global.dict.config;
                if (cfg.level_remove > level) throw `Access level '${cfg.level_remove}' is required.`;
                const word = this.getdict(action), str = action.options.getString('string'), list = global.dict.search(word, str, level);
                if (!list.length) throw `There are no dictionary matches in '${word}' for '${escapeMarkdown(str)}'.`;
                await global.confirm.open(action, {
                    command: 'dict',
                    title: `${global.emoji.icons('menu')}**Dictionary: ${word}**`,
                    list: list,
                    mass: list.length > 1,
                    level_mass: cfg.level_mass,
                    massnote: 'remove more than one entry',
                    ttl: cfg.buttonttl,
                    apply: () => {
                        const ret = global.dict.remove(word, list);
                        global.log.audit(`${action.user.tag} removed ${ret} entr${ret === 1 ? 'y' : 'ies'} from dictionary '${word}'`);
                        return ret;
                    }
                });
                break;
            }
            default: {
                throw `Invalid sub-command '${func}'. Valid commands are: ${global.tools.subcommands(this.config)}`;
            }
        }
    },
    async button(bot, action, id, op) {
        await global.confirm.button(action, id, op);
    }
};
