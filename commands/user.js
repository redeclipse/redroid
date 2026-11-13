const { ApplicationCommandOptionType, escapeMarkdown } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'user',
            description: 'View or manage user identity links and IRC nickname aliases.',
            options: [
                {
                    name: 'view',
                    description: 'View a user\'s canonical name, linked Discord account(s), aliases, and stats.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'target',
                            description: 'User mention, Discord name, or IRC nickname.',
                            required: true
                        }
                    ]
                },
                {
                    name: 'link',
                    description: 'Link or unlink a Discord account for a canonical user name.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'name',
                            description: 'Canonical user name.',
                            required: true
                        },
                        {
                            type: ApplicationCommandOptionType.User,
                            name: 'user',
                            description: 'Discord user account.',
                            required: true
                        },
                        {
                            type: ApplicationCommandOptionType.Boolean,
                            name: 'unlink',
                            description: 'Remove this Discord account link instead of adding it.',
                            required: false
                        }
                    ]
                },
                {
                    name: 'alias',
                    description: 'Add or remove an alternate nickname for a canonical user name.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'name',
                            description: 'Canonical user name.',
                            required: true
                        },
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'alias',
                            description: 'Alternate nickname.',
                            required: true
                        },
                        {
                            type: ApplicationCommandOptionType.Boolean,
                            name: 'remove',
                            description: 'Remove this alias instead of adding it.',
                            required: false
                        }
                    ]
                },
                {
                    name: 'rename',
                    description: 'Rename a canonical user across users, quotes, tipjar, and FAQs.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'oldname',
                            description: 'Current canonical name.',
                            required: true
                        },
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'newname',
                            description: 'New canonical name.',
                            required: true
                        }
                    ]
                }
            ]
        }
    },
    formatentry(key, guild) {
        const entry = global.users.users[key] || { ids: [], aliases: [] };
        const qkey = global.quote && global.users.findstorekey(global.quote.quotes, key, false);
        const quotes = qkey && global.quote.quotes[qkey] ? global.quote.quotes[qkey].length : 0;
        const tkey = global.stats && global.stats.findtip(key);
        const hasTip = Boolean(tkey);
        const tip = hasTip ? global.stats.data.tipjar[tkey] : 0;
        const fkey = global.faq && global.users.findstorekey(global.faq.faqs, key, false);
        const faqs = fkey && global.faq.faqs[fkey] ? global.faq.faqs[fkey].length : 0;

        let discordStr = 'None';
        if (entry.ids.length > 0) {
            discordStr = entry.ids.map(id => `<@${id}> (\`${id}\`)`).join(', ');
        }
        else {
            const auto = global.users.findmember(guild, key);
            if (auto && auto.id) discordStr = `<@${auto.id}> (\`${auto.id}\`, auto-matched)`;
        }

        const aliasesStr = entry.aliases.length > 0
            ? entry.aliases.map(a => `\`${escapeMarkdown(a)}\``).join(', ')
            : 'None';

        const statsParts = [ `Quotes: **${quotes}**` ];
        if (hasTip) statsParts.push(`Tipjar: **${tip}**`);
        if (faqs > 0) statsParts.push(`FAQs: **${faqs}**`);

        return [
            `**Canonical Name:** \`${escapeMarkdown(key)}\``,
            `**Discord:** ${discordStr}`,
            `**Aliases:** ${aliasesStr}`,
            `**Data:** ${statsParts.join(' • ')}`
        ].join('\n');
    },
    async execute(bot, action) {
        const func = action.options.getSubcommand();
        switch (func) {
            case 'view': {
                const raw = action.options.getString('target');
                const resolved = await global.users.resolve(action, raw);
                const key = resolved ? resolved.name : raw.trim();
                const exists = Boolean(
                    global.users.users[key]
                    || (global.quote && global.users.findstorekey(global.quote.quotes, key, false))
                    || (global.stats && global.stats.findtip(key))
                    || (global.faq && global.users.findstorekey(global.faq.faqs, key, false))
                    || (resolved && resolved.id)
                );
                if (!exists) {
                    throw `No user, quote, tipjar, or FAQ entry found for '${escapeMarkdown(raw)}'.`;
                }
                await action.reply({
                    embeds: [{
                        color: 0x8888ff,
                        title: `👤 User: ${escapeMarkdown(key)}`,
                        description: this.formatentry(key, action.guild)
                    }]
                });
                break;
            }
            case 'link': {
                const name = action.options.getString('name').trim();
                const user = action.options.getUser('user');
                const unlink = Boolean(action.options.getBoolean('unlink'));
                const res = global.users.link(name, user.id, unlink);
                await action.reply({
                    embeds: [{
                        color: 0x8888ff,
                        title: unlink ? '🔗 User Unlinked' : '🔗 User Linked',
                        description: `${unlink ? 'Unlinked' : 'Linked'} <@${user.id}> ${unlink ? 'from' : 'to'} \`${escapeMarkdown(res.key)}\`.\n\n${this.formatentry(res.key, action.guild)}`
                    }]
                });
                break;
            }
            case 'alias': {
                const name = action.options.getString('name').trim();
                const alias = action.options.getString('alias').trim();
                const remove = Boolean(action.options.getBoolean('remove'));
                const res = global.users.alias(name, alias, remove);
                const mergedNotes = [];
                if (res.merged) {
                    if (res.merged.quotes > 0) mergedNotes.push(`${res.merged.quotes} quote(s)`);
                    if (res.merged.tipjar !== 0) mergedNotes.push(`tipjar (${res.merged.tipjar})`);
                    if (res.merged.faqs > 0) mergedNotes.push(`${res.merged.faqs} FAQ(s)`);
                }
                const mergeLine = mergedNotes.length > 0 ? `\nMerged into \`${escapeMarkdown(res.key)}\`: ${mergedNotes.join(', ')}.` : '';
                await action.reply({
                    embeds: [{
                        color: 0x8888ff,
                        title: remove ? '🏷️ Alias Removed' : '🏷️ Alias Added',
                        description: `${remove ? 'Removed' : 'Added'} alias \`${escapeMarkdown(res.alias)}\` ${remove ? 'from' : 'for'} \`${escapeMarkdown(res.key)}\`.${mergeLine}\n\n${this.formatentry(res.key, action.guild)}`
                    }]
                });
                break;
            }
            case 'rename': {
                const oldname = action.options.getString('oldname').trim();
                const newname = action.options.getString('newname').trim();
                const res = global.users.rename(oldname, newname);
                const mergedNotes = [];
                if (res.merged.quotes > 0) mergedNotes.push(`${res.merged.quotes} quote(s)`);
                if (res.merged.tipjar !== 0) mergedNotes.push(`tipjar (${res.merged.tipjar})`);
                if (res.merged.faqs > 0) mergedNotes.push(`${res.merged.faqs} FAQ(s)`);
                const mergeLine = mergedNotes.length > 0 ? `\nMoved: ${mergedNotes.join(', ')}.` : '';
                await action.reply({
                    embeds: [{
                        color: 0x8888ff,
                        title: '✏️ User Renamed',
                        description: `Renamed \`${escapeMarkdown(res.oldkey)}\` to \`${escapeMarkdown(res.newkey)}\`.${mergeLine}\n\n${this.formatentry(res.newkey, action.guild)}`
                    }]
                });
                break;
            }
            default: {
                throw `Invalid sub-command '${func}'. Valid commands are: ${global.tools.subcommands(this.config)}`;
            }
        }
    }
};
