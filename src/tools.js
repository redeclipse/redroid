const fs = require('fs');

module.exports = {
    name: 'tools',
    config: null, // config.tools
    start(bot) {
        this.config = bot.config.tools;
        if (!this.config) throw new Error('Tools: config.tools is needed.');
        return true;
    },

    // Maths
    rand(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    },

    // Strings
    escaperegex(str) {
        return str.replace(/[\\^$.*+?()[\]{}|/-]/g, '\\$&');
    },
    // Plain text search, or /regex/flags for trusted users: user regexes can backtrack for minutes and block the bot
    strtoregex(str, level = 0) {
        const args = str.match(/^\/(.*)\/([imsu]*)$/);
        if (!args) return new RegExp(this.escaperegex(str), 'i');
        if (level < this.config.level_regex) throw `Access level '${this.config.level_regex}' is required to search with a regular expression.`;
        if (args[1].length > this.config.regex_maxlen) throw `Regular expressions are limited to ${this.config.regex_maxlen} characters.`;
        try {
            return new RegExp(args[1], args[2]);
        }
        catch (e) {
            throw e.message;
        }
    },

    // Users / Members
    async getmember(action, user) {
        return await action.guild.members.fetch(user.id);
    },
    async randomuser(action, value) {
        const user = action.options.getUser(value);
        if (user) return user;
        // The member cache is filled on ready and kept current by the GuildMembers intent
        const member = action.guild.members.cache.filter(m => m.user.id !== action.user.id).random();
        return member ? member.user : action.user;
    },
    async randommember(action, value) {
        const user = await this.randomuser(action, value);
        return await this.getmember(action, user);
    },
    defaultuser(action, value) {
        let user = action.options.getUser(value);
        if (!user) user = action.user;
        return user;
    },
    async defaultmember(action, value) {
        const user = action.options.getUser(value);
        if (!user) return action.member;
        return await this.getmember(action, user);
    },
    async pickuser(action, value) {
        if (global.access.level(action.guild, action.user) >= this.config.level_random) return await this.randomuser(action, value);
        return this.defaultuser(action, value);
    },
    async pickmember(action, value) {
        if (global.access.level(action.guild, action.user) >= this.config.level_random) return await this.randommember(action, value);
        return await this.defaultmember(action, value);
    },

    // Files
    // Write to a temporary file and rename it over the original, so a crash mid-write cannot truncate the data;
    // the previous version is kept as <name>.bak
    writejson(file, data) {
        const tmp = `${file}.tmp`, bak = file.replace(/\.json$/, '') + '.bak';
        try {
            fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
            if (fs.existsSync(file)) fs.copyFileSync(file, bak);
            fs.renameSync(tmp, file);
            return true;
        }
        catch (e) {
            global.log.error(`Saving failed: ${file} (${e.message})`);
            try { fs.rmSync(tmp, { force: true }); }
            catch { /* nothing more to do */ }
            return false;
        }
    },

    // Messages
    async react(message, emojiid) {
        const emoji = message.guild ? message.guild.emojis.cache.get(emojiid) : null;
        if (emoji) await message.react(emoji);
    },

    // Command helpers
    subcommands(config) {
        return config.chat.options.map(value => value.name).join(', ');
    },

    embedfields(embed, list, page = 0) {
        const offset = page * 24;
        let count = 0, more = 0, amount = 0;
        for (const result in list) {
            if (count >= offset) {
                if (amount >= 24) { more++; }
                else {
                    const index = parseInt(result, 10) + 1;
                    embed.fields.push({ name: `[${index}]`, value: list[result], inline: true });
                    amount++;
                }
            }
            count++;
        }
        const pages = Math.ceil(count / 24) - 1;
        return { count: count, more: more, amount: amount, page: { cur: page, num: pages } };
    }
};
