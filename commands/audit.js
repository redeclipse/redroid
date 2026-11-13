const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'audit',
            description: 'View or configure Carl-bot style audit logging.',
            options: [
                {
                    name: 'status',
                    description: 'Show current audit logging status, cached messages, ignored channels, and categories.',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'ignore',
                    description: 'Toggle ignoring a channel, thread, or category for message edit/delete logging.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.Channel,
                            name: 'channel',
                            description: 'Channel, thread, or category to ignore or unignore.',
                            required: true
                        }
                    ]
                },
                {
                    name: 'toggle',
                    description: 'Toggle an audit logging event category on or off.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'category',
                            description: 'Audit event category.',
                            required: true,
                            choices: (global.audit ? global.audit.categories : []).map(c => ({ name: c, value: c }))
                        }
                    ]
                }
            ]
        }
    },
    formatstatus(bot) {
        const chanId = bot.config.channels && bot.config.channels.audit;
        const chanStr = chanId ? `<#${chanId}> (\`${chanId}\`)` : '*Not configured*';
        const cachedStr = `${global.audit.cache.size} / ${global.audit.config.cache}`;
        const ignored = [...global.audit.ignored];
        const ignoredStr = ignored.length
            ? ignored.map(id => `<#${id}>`).join(', ')
            : 'None';
        const catLines = global.audit.categories.map(cat => {
            const on = !global.audit.disabled.has(cat);
            return `${on ? '✅' : '❌'} \`${cat}\``;
        });
        return [
            `**Audit Channel:** ${chanStr}`,
            `**Message Cache:** ${cachedStr}`,
            `**Ignored Channels:** ${ignoredStr}`,
            `**Categories:** ${catLines.join(' • ')}`
        ].join('\n');
    },
    async execute(bot, action) {
        if (!global.audit || !global.audit.config) throw 'The audit module is not active.';
        const func = action.options.getSubcommand();
        switch (func) {
            case 'status': {
                await action.reply({
                    embeds: [{
                        color: global.audit.config.colours.info,
                        title: '📋 Audit Logging Status',
                        description: this.formatstatus(bot)
                    }]
                });
                break;
            }
            case 'ignore': {
                const chan = action.options.getChannel('channel');
                const added = global.audit.toggleignore(chan.id);
                await action.reply({
                    embeds: [{
                        color: global.audit.config.colours.info,
                        title: added ? '🔇 Channel Ignored' : '🔊 Channel Unignored',
                        description: `${added ? 'Now ignoring' : 'No longer ignoring'} <#${chan.id}> for message edit/delete audit logs.\n\n${this.formatstatus(bot)}`
                    }]
                });
                break;
            }
            case 'toggle': {
                const category = action.options.getString('category');
                const enabled = global.audit.togglecategory(category);
                await action.reply({
                    embeds: [{
                        color: global.audit.config.colours.info,
                        title: enabled ? '✅ Category Enabled' : '❌ Category Disabled',
                        description: `Audit logging for \`${category}\` is now **${enabled ? 'enabled' : 'disabled'}**.\n\n${this.formatstatus(bot)}`
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
