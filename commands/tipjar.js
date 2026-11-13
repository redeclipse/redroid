const { ApplicationCommandOptionType, escapeMarkdown } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'tipjar',
            description: 'View or update the request tipjar, or ask for a refund.',
            options: [
                {
                    name: 'view',
                    description: 'View a user\'s tipjar balance.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'target',
                            description: 'User mention or name.',
                            required: true
                        }
                    ]
                },
                {
                    name: 'add',
                    description: 'Charge a victim to add to a user\'s tipjar.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'target',
                            description: 'Recipient user mention or name (level 4+).',
                            required: true
                        },
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'victim',
                            description: 'Victim user mention or name.',
                            required: true
                        },
                        {
                            type: ApplicationCommandOptionType.Integer,
                            name: 'count',
                            description: 'Number of requests to add (default 1).',
                            required: false,
                            min_value: 1
                        }
                    ]
                },
                {
                    name: 'revert',
                    description: 'Subtract from a user\'s tipjar.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'target',
                            description: 'Recipient user mention or name.',
                            required: true
                        },
                        {
                            type: ApplicationCommandOptionType.Integer,
                            name: 'count',
                            description: 'Number of requests to subtract (default 1).',
                            required: false,
                            min_value: 1
                        }
                    ]
                },
                {
                    name: 'refund',
                    description: 'Request a refund.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.User,
                            name: 'user',
                            description: 'Select a user.',
                            required: false
                        }
                    ]
                }
            ]
        }
    },
    async resolvetarget(action, raw) {
        const minlevel = global.stats.config.level_tipjar;
        let member = await global.tools.resolvemember(action, raw);
        if (!member && action.guild) {
            const lower = raw.toLowerCase();
            member = action.guild.members.cache.find(
                m => m.displayName.toLowerCase() === lower || m.user.username.toLowerCase() === lower
            ) || null;
        }
        if (member) {
            const key = global.stats.findtip(member.displayName) || global.stats.findtip(member.user.username);
            const tlevel = global.access.level(action.guild, member.user);
            if (!key && tlevel < minlevel) {
                throw `User <@${member.user.id}> must have access level '${minlevel}' or higher.`;
            }
            return {
                key: key || member.user.username,
                display: `<@${member.user.id}>`
            };
        }
        const key = global.stats.findtip(raw);
        if (!key) {
            throw `User '${escapeMarkdown(raw)}' is not in the tipjar (must have access level '${minlevel}' or higher).`;
        }
        return {
            key: key,
            display: escapeMarkdown(key)
        };
    },
    formatbalance(key, display, count) {
        const lower = key.toLowerCase();
        if (lower === 'eihrul' || lower.startsWith('eihrul_')) {
            return `If ${display} had a bottle of Hennessey for every request, they would have: **${count} ${count === 1 ? 'bottle' : 'bottles'}**`;
        }
        if (lower === 'acerspyro') {
            return `If ${display} had a penis for every request, they would have: **${count} ${count === 1 ? 'penis' : 'penises'}**`;
        }
        const dollars = count * 50;
        return `If ${display} had $50 dollars for every request, they would have: **$${dollars}**`;
    },
    async execute(bot, action) {
        const func = action.options.getSubcommand(), level = global.access.level(action.guild, action.user);
        const minlevel = global.stats.config.level_tipjar;
        switch (func) {
            case 'view': {
                const targ = await this.resolvetarget(action, action.options.getString('target'));
                const count = global.stats.gettip(targ.key);
                await action.reply({
                    embeds: [{
                        color: 0x8888ff,
                        title: '🫙 Tipjar',
                        description: this.formatbalance(targ.key, targ.display, count)
                    }]
                });
                break;
            }
            case 'add': {
                if (level < minlevel) throw `Access level '${minlevel}' is required.`;
                const targ = await this.resolvetarget(action, action.options.getString('target'));
                const victimraw = action.options.getString('victim');
                const victimmember = await global.tools.resolvemember(action, victimraw);
                const victimposs = victimmember
                    ? `<@${victimmember.user.id}>'s`
                    : global.tools.plural(escapeMarkdown(victimraw));
                const amount = action.options.getInteger('count') || 1;
                const updated = global.stats.addtip(targ.key, amount);
                let act;
                if (targ.key.toLowerCase() === 'acerspyro') {
                    act = `<@${bot.user.id}> grabs ${victimposs} genitals`;
                }
                else if (global.tools.rand(0, 2) === 0) {
                    act = `<@${bot.user.id}> grabs ${victimposs} wallet and steals some money`;
                }
                else {
                    act = `<@${bot.user.id}> charges ${victimposs} bank account without consent`;
                }
                await action.reply({
                    embeds: [{
                        color: 0x8888ff,
                        title: '🫙 Tipjar',
                        description: `${act}\n\n${this.formatbalance(targ.key, targ.display, updated.value)}`
                    }]
                });
                break;
            }
            case 'revert': {
                if (level < minlevel) throw `Access level '${minlevel}' is required.`;
                const targ = await this.resolvetarget(action, action.options.getString('target'));
                const amount = action.options.getInteger('count') || 1;
                const updated = global.stats.addtip(targ.key, -amount);
                await action.reply({
                    embeds: [{
                        color: 0x8888ff,
                        title: '🫙 Tipjar',
                        description: this.formatbalance(targ.key, targ.display, updated.value)
                    }]
                });
                break;
            }
            case 'refund': {
                const user = action.options.getUser('user');
                await action.reply({
                    embeds: [{
                        color: 0x8888ff,
                        title: '💸 Refund',
                        description: user ? `<@${user.id}>: Sorry, no refunds.` : 'Sorry, no refunds.'
                    }]
                });
                break;
            }
            default: {
                throw `Invalid sub-command '${func}'. Valid commands are: ${global.tools.subcommands(this.config)}`;
            }
        }
    },
};
