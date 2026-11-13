module.exports = {
    config: {
        chat: {
            name: 'roulette',
            description: 'Play a game of Russian roulette.',
            options: []
        }
    },
    rnd: 0,
    pos: 1,
    timer: null,
    reload() {
        const chambers = (global.stats.config && global.stats.config.roulette_chambers) || 6;
        this.rnd = global.tools.rand(1, chambers + 1);
        this.pos = 1;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    },
    async execute(bot, action) {
        if (!this.rnd) this.reload();
        const count = global.stats.inc('roulette'), mile = global.stats.milestone(count, 'round of roulette played');
        const level = global.access.level(action.guild, action.user);
        const embed = {
            color: 0x8888ff,
            title: '🔫 Roulette',
            description: ''
        };
        if (mile) embed.footer = { text: mile };

        if (this.pos === this.rnd) {
            embed.color = 0xff8888;
            const timeoutms = global.stats.config.roulette_timeout;
            if (level >= 10) {
                const bystander = await global.tools.randomuser(action, null);
                embed.description = `**BANG!** The bullet missed <@${action.user.id}> and killed <@${bystander.id}> instead.\n\n*<@${bot.user.id}> reloads the gun and spins the chamber.*`;
                await global.tools.timeoutmember(action, bystander, timeoutms, 'BANG! Killed by a stray roulette bullet.');
            }
            else {
                embed.description = `<@${action.user.id}>: **BANG!** You're dead.\n\n*<@${bot.user.id}> reloads the gun and spins the chamber.*`;
                await global.tools.timeoutmember(action, action.user, timeoutms, 'BANG! You lost Russian roulette.');
            }
            this.reload();
        }
        else {
            embed.description = `<@${action.user.id}>: *Click*, you survived. Who's next? To play, type: \`/roulette\``;
            this.pos++;
            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(() => this.reload(), global.stats.config.roulette_reset);
        }
        await action.reply({ embeds: [ embed ] });
    },
};
