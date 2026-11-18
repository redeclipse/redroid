const { ApplicationCommandOptionType, escapeMarkdown } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'faq',
            description: 'Look up, search or change the FAQ.',
            options: [
                {
                    name: 'show',
                    description: 'Look up or search the FAQ.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'target',
                            description: 'Select topic or target.',
                            required: false
                        },
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'search',
                            description: 'Select search terms.',
                            required: false
                        }
                    ]
                },
                {
                    name: 'add',
                    description: 'Add an answer to a topic, making the topic if it is new.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'topic',
                            description: 'Topic to add to.',
                            required: true,
                            max_length: 100
                        },
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'answer',
                            description: 'Answer to add.',
                            required: true,
                            max_length: 1024
                        }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Remove answers from a topic, or the whole topic.',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'topic',
                            description: 'Topic to remove from.',
                            required: true
                        },
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'search',
                            description: 'Answers to remove; leave out to remove the whole topic.',
                            required: false
                        }
                    ]
                }
            ]
        }
    },
    // The stored topic a change applies to: the topic itself ignoring case, or a player's topic by mention or exact name
    async topic(action, raw) {
        const name = raw.trim();
        if (!name) throw 'No topic provided.';
        const direct = global.faq.topic(name);
        if (direct) return { name: direct, found: true };
        if (name.slice(0, 1) !== '/' && global.users) {
            let ukey = null;
            if (/^(?:<@!?\d+>|\d{17,20})$/.test(name)) {
                const resolved = await global.users.resolve(action, name);
                if (resolved) ukey = resolved.name;
            }
            else { ukey = global.users.findkey(name, false); }
            const utopic = ukey ? global.faq.topic(ukey) : null;
            if (utopic) return { name: utopic, found: true };
        }
        return { name, found: false };
    },
    async execute(bot, action) {
        const func = action.options.getSubcommand(), level = global.access.level(action.guild, action.user);
        switch (func) {
            case 'show': await this.show(action, level); break;
            case 'add': await this.add(action, level); break;
            case 'remove': await this.remove(action, level); break;
            default: throw `Invalid sub-command '${func}'. Valid commands are: ${global.tools.subcommands(this.config)}`;
        }
    },
    async add(action, level) {
        if (global.faq.config.level_add > level) throw `Access level '${global.faq.config.level_add}' is required.`;
        const topic = await this.topic(action, action.options.getString('topic')), answer = action.options.getString('answer').trim();
        if (!answer) throw 'No answer provided.';
        const ret = global.faq.add(topic.name, answer);
        global.log.out(`FAQ: ${action.user.username} added answer ${ret.index} to '${ret.topic}'`);
        await action.reply({
            embeds: [{
                color: 0x8888ff,
                description: `${global.emoji.icons('question')}**FAQ: ${escapeMarkdown(ret.topic)}**\n${ret.created ? 'New topic, added' : `Added answer ${ret.index}`}: ${answer}`
            }]
        });
    },
    async remove(action, level) {
        const cfg = global.faq.config;
        if (cfg.level_remove > level) throw `Access level '${cfg.level_remove}' is required.`;
        const topic = await this.topic(action, action.options.getString('topic')), str = action.options.getString('search');
        if (!topic.found) throw `There is no FAQ '${escapeMarkdown(topic.name)}'.`;
        const answers = global.faq.faqs[topic.name];
        let list = answers;
        if (str) {
            const regex = global.tools.strtoregex(str, level);
            list = answers.filter(value => value.match(regex));
            if (!list.length) throw `There are no answers in '${escapeMarkdown(topic.name)}' matching '${escapeMarkdown(str)}'.`;
        }
        const whole = list.length === answers.length;
        await global.confirm.open(action, {
            command: 'faq',
            title: `${global.emoji.icons('question')}**FAQ: ${escapeMarkdown(topic.name)}**${whole ? ' (the whole topic)' : ''}`,
            list: [ ...list ],
            mass: whole || list.length > 1,
            level_mass: cfg.level_mass,
            massnote: 'remove a whole topic or more than one answer',
            ttl: cfg.buttonttl,
            apply: () => {
                const ret = global.faq.remove(topic.name, whole ? null : list);
                global.log.out(`FAQ: ${action.user.username} removed ${ret} answer(s) from '${topic.name}'${whole ? ', and the topic' : ''}`);
                return ret;
            }
        });
    },
    async button(bot, action, id, op) {
        await global.confirm.button(action, id, op);
    },
    async show(action, level) {
        const rawtarget = action.options.getString('target'), str = action.options.getString('search');
        let target = rawtarget;
        if (rawtarget && rawtarget.slice(0, 1) !== '/') {
            const resolved = await global.users.resolve(action, rawtarget);
            if (resolved && (global.faq.faqs[resolved.name] || Object.keys(global.faq.faqs).some(k => k.toLowerCase() === resolved.name.toLowerCase()))) {
                target = resolved.name;
            }
        }
        const data = global.faq.query(target, str, level);
        if (!data || ((!data.value || !data.value.length) && (!data.matches || !Object.keys(data.matches).length))) {
            let msg = 'There are no FAQs';
            if (rawtarget) msg += ` for '${escapeMarkdown(rawtarget)}'`;
            if (str) msg += ` matching '${escapeMarkdown(str)}'`;
            msg += '.';
            throw msg;
        }

        global.stats.inc('faq');
        const icon = global.emoji.icons('question');
        const embed = {
            color: 0x8888ff,
            description: data.name
                ? `${icon}**FAQ: ${escapeMarkdown(data.name)}**${str ? `\n*Searching for: ${escapeMarkdown(str)}*` : ''}`
                : `${icon}**FAQ Search** — *${escapeMarkdown(str)}*`,
            footer: { text: '' }
        };
        if (data.matches) {
            const keys = Object.keys(data.matches);
            let shown = 0;
            for (const key of keys) {
                const line = `\n**${escapeMarkdown(key)}:** ${data.matches[key].join(' | ')}`;
                if (embed.description.length + line.length > 4000) break;
                embed.description += line;
                shown++;
            }
            embed.footer.text = `FAQ ${shown} of ${data.total}`;
        }
        else if (data.value.length === 1) {
            embed.description += `\n${data.value[0]}`;
            embed.footer.text = `FAQ ${data.index} of ${data.total}`;
            if (data.also && data.also.length) {
                const extra = data.also.slice(0, 10).join(', ') + (data.also.length > 10 ? ', ...' : '');
                embed.footer.text += ` • Also matching: ${extra}`;
            }
        }
        else {
            for (let i = 0; i < data.value.length; i++) {
                const line = `\n**${i + 1}.** ${data.value[i]}`;
                if (embed.description.length + line.length > 4000) break;
                embed.description += line;
            }
            embed.footer.text = `FAQ ${data.index} of ${data.total}`;
            if (data.also && data.also.length) {
                const extra = data.also.slice(0, 10).join(', ') + (data.also.length > 10 ? ', ...' : '');
                embed.footer.text += ` • Also matching: ${extra}`;
            }
        }
        await action.reply({ embeds: [embed] });
    },
};
