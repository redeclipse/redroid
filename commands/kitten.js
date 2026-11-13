const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'kitten',
            description: 'Sacrifice or revive kittens in the name of noobs.',
            options: [
                {
                    name: 'kill',
                    description: 'Sacrifice a kitten in the name of noobs.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.User,
                            name: 'user',
                            description: 'Select a user',
                            required: false
                        }
                    ]
                },
                {
                    name: 'revive',
                    description: 'Revive a sacrificed kitten into a zombie.',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'stats',
                    description: 'Show kitten and zombie counts.',
                    type: ApplicationCommandOptionType.Subcommand
                }
            ]
        }
    },
    async execute(bot, action) {
        const func = action.options.getSubcommand(), level = global.access.level(action.guild, action.user);
        switch (func) {
            case 'kill': {
                const user = await global.tools.pickuser(action, 'user');
                const kittens = global.stats.inc('kitten'), obits = global.stats.inc('obit');
                const embed = {
                    color: 0x8888ff,
                    title: '🐱 Kitten',
                    description: 'A kitten was '
                };
                embed.description += global.dict.query('killed', action.user, user);
                embed.description += ' with ';
                embed.description += global.dict.query('object', action.user, user);
                embed.description += ` by <@${user.id}>`;
                if (global.tools.rand(0, 6)) {
                    embed.description += ', ';
                    embed.description += global.dict.query('style', action.user, user);
                }
                embed.description += ` - ${kittens} kittens have now been killed in the name of noobs`;
                const miles = [
                    global.stats.milestone(kittens, 'kitten to be sacrificed'),
                    global.stats.milestone(obits, 'obituary to be announced')
                ].filter(Boolean);
                if (miles.length) embed.footer = { text: miles.join(' ') };
                await action.reply({ embeds: [ embed ] });
                break;
            }
            case 'revive': {
                if (level < global.stats.config.level_revive) throw `Access level '${global.stats.config.level_revive}' is required.`;
                const kittens = global.stats.inc('kitten', -1);
                global.stats.inc('obit', -1);
                const zombies = global.stats.inc('zombie', 1);
                const embed = {
                    color: 0x8888ff,
                    title: '🧟 Kitten Revived',
                    description: `A kitten was revived by <@${action.user.id}>, leaving ${zombies} zombies, and ${kittens} kittens killed in the name of noobs`
                };
                await action.reply({ embeds: [ embed ] });
                break;
            }
            case 'stats': {
                const kittens = global.stats.get('kitten'), zombies = global.stats.get('zombie');
                const embed = {
                    color: 0x8888ff,
                    title: '🐱 Kitten Stats',
                    description: `${kittens} kittens have been killed in the name of noobs` + (zombies ? ` (${zombies} zombies revived)` : '')
                };
                await action.reply({ embeds: [ embed ] });
                break;
            }
            default: {
                throw `Invalid sub-command '${func}'. Valid commands are: ${global.tools.subcommands(this.config)}`;
            }
        }
    },
};
