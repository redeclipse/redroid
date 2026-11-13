const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    config: {
        chat: {
            name: 'judge',
            description: 'Take someone to court and let the judge pass a death sentence.',
            options: [
                {
                    type: ApplicationCommandOptionType.User,
                    name: 'user',
                    description: 'Select a defendant',
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.User,
                    name: 'user2',
                    description: 'Select an additional defendant',
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.User,
                    name: 'user3',
                    description: 'Select an additional defendant',
                    required: false
                }
            ]
        }
    },
    last: 0,
    async execute(bot, action) {
        const targets = [
            action.options.getUser('user'),
            action.options.getUser('user2'),
            action.options.getUser('user3')
        ].filter(Boolean);

        if (!targets.length) {
            const count = global.stats.get('judge');
            await action.reply({
                embeds: [{
                    color: 0x8888ff,
                    title: '⚖️ Judge',
                    description: `A total of ${count} people have been killed in the name of the law.`
                }]
            });
            return;
        }

        const now = Date.now(), cooldown = global.stats.config.judge_cooldown;
        if (now - this.last < cooldown) {
            throw `Sorry, the judge is out, please wait at least ${Math.ceil((cooldown - (now - this.last)) / 1000)} seconds.`;
        }
        this.last = now;

        const parties = [ action.user ];
        for (const u of targets) {
            if (!parties.some(p => p.id === u.id)) parties.push(u);
        }

        let loser = parties[global.tools.rand(0, parties.length)];
        if (global.access.level(action.guild, loser) >= 10) loser = action.user;

        const reason = loser.id === action.user.id
            ? 'You were executed for starting a frivolous lawsuit.'
            : 'You were sued and sentenced to death.';

        await global.tools.timeoutmember(action, loser, global.stats.config.judge_timeout, reason);

        const count = global.stats.inc('judge'), mile = global.stats.milestone(count, 'judgement passed');
        const vs = parties.map(u => `<@${u.id}>`).join(' vs. ');
        const embed = {
            color: 0x8888ff,
            title: '⚖️ Judge',
            description: `${vs}\n\n<@${loser.id}>: ${reason}\n\nA total of ${count} people have been killed in the name of the law.`
        };
        if (mile) embed.footer = { text: mile };
        await action.reply({ embeds: [ embed ] });
    },
};
