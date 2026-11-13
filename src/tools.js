const fs = require('fs');
const path = require('path');

const DAY = 86400000;

module.exports = {
    name: 'tools',
    config: null, // config.tools
    db: null, // config.db: where the daily snapshots go, and how many days of them are kept
    locked: new Set(), // files that were there but could not be read, never written over
    failed: new Map(), // file -> the data its last save could not write, tried again at shutdown
    start(bot) {
        this.config = bot.config.tools;
        if (!this.config) throw new Error('Tools: config.tools is needed.');
        this.db = bot.config.db;
        if (!this.db || !this.db.daily || !(this.db.keep > 0)) throw new Error('Tools: config.db.daily and config.db.keep are needed.');
        return true;
    },
    // Sources shut down in name order, so those that save as they stop have done so by now
    shutdown() {
        for (const [ file, data ] of this.failed) {
            global.log.out(`Saving again: ${file}`);
            this.writejson(file, data);
        }
    },

    // Maths
    rand(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    },

    // Strings
    escaperegex(str) {
        return str.replace(/[\\^$.*+?()[\]{}|/-]/g, '\\$&');
    },
    plural(str) {
        const lower = str.toLowerCase();
        return `${str}'${lower.endsWith('s') || lower.endsWith('z') ? '' : 's'}`;
    },
    dur(secs) {
        let rem = Math.max(0, Math.floor(Math.abs(secs)));
        if (rem === 0) return '0s';
        const units = [
            [ 'w', 604800 ],
            [ 'd', 86400 ],
            [ 'h', 3600 ],
            [ 'm', 60 ],
            [ 's', 1 ]
        ];
        let out = '';
        for (const [ label, div ] of units) {
            if (rem >= div) {
                const val = Math.floor(rem / div);
                rem %= div;
                out += `${val}${label}`;
            }
        }
        return secs < 0 ? `-${out}` : out;
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
    async resolvemember(action, str) {
        if (!str || !action.guild) return null;
        const match = str.trim().match(/^(?:<@!?(\d+)>|(\d{17,20}))$/);
        if (!match) return null;
        const id = match[1] || match[2];
        const cached = action.guild.members.cache.get(id);
        if (cached) return cached;
        try {
            return await action.guild.members.fetch(id);
        }
        catch {
            return null;
        }
    },
    async timeoutmember(action, user, ms, reason) {
        if (!action.guild || !user || !ms || ms <= 0) return false;
        try {
            const member = await this.getmember(action, user);
            if (!member || !member.moderatable) return false;
            await member.timeout(ms, reason);
            return true;
        }
        catch {
            return false;
        }
    },

    // Files
    sibling(file, ext) {
        return file.replace(/\.json$/, '') + ext;
    },
    isobject(data) {
        return data !== null && typeof data === 'object' && !Array.isArray(data);
    },
    // Each source reads its file in its start(), before this one has started, so this needs nothing from config.
    // A file that is there but won't parse or fails valid() gives way to its .bak, and is moved aside as <name>.bad
    // so the next save can't copy it over the good .bak; with neither readable, the file is locked against saving.
    // Returns undefined when there is nothing to load, so the source keeps its empty data.
    readjson(file, valid = data => this.isobject(data)) {
        const bak = this.sibling(file, '.bak'), bad = this.sibling(file, '.bad'), problems = [];
        const read = name => {
            if (!fs.existsSync(name)) return undefined;
            try {
                const data = JSON.parse(fs.readFileSync(name, 'utf-8'));
                if (valid(data)) return data;
                problems.push(`${name}: not the expected shape`);
            }
            catch (e) {
                problems.push(`${name}: ${e.message}`);
            }
            return null;
        };
        const main = read(file);
        if (main) return main;
        const backup = read(bak);
        if (backup) {
            if (main === null) {
                try {
                    fs.renameSync(file, bad);
                }
                catch (e) {
                    problems.push(`moving it to ${bad}: ${e.message}`);
                    this.locked.add(file);
                }
            }
            global.log.warn(`Loaded ${bak} instead of ${file}${main === null ? `, which was moved to ${bad}` : ', which was missing'} (${problems.join('; ')})`);
            return backup;
        }
        if (main === null || backup === null) {
            this.locked.add(file);
            global.log.error(`Could not load ${file} or ${bak}, so nothing will be saved to it until it is fixed and the bot restarted (${problems.join('; ')})`);
        }
        return undefined;
    },
    // On a file's first save of the day (UTC) its current copy goes to config.db.daily, under its path from the folder
    // that holds config.db.daily, and its snapshots older than config.db.keep days are removed
    snapshot(file) {
        if (!this.db || !fs.existsSync(file)) return;
        const root = path.dirname(this.db.daily);
        let rel = path.relative(root, file);
        if (rel.startsWith('..') || path.isAbsolute(rel)) rel = path.basename(file);
        const base = path.join(this.db.daily, this.sibling(rel, '')), dir = path.dirname(base), prefix = path.basename(base) + '-';
        const day = new Date().toISOString().slice(0, 10), snap = `${base}-${day}.json`;
        if (fs.existsSync(snap)) return;
        try {
            fs.mkdirSync(dir, { recursive: true });
            fs.copyFileSync(file, snap);
            const oldest = new Date(Date.now() - this.db.keep * DAY).toISOString().slice(0, 10);
            for (const name of fs.readdirSync(dir)) {
                if (!name.startsWith(prefix) || !name.endsWith('.json')) continue;
                const when = name.slice(prefix.length, -5);
                if (/^\d{4}-\d{2}-\d{2}$/.test(when) && when < oldest) fs.rmSync(path.join(dir, name), { force: true });
            }
        }
        catch (e) {
            global.log.error(`Daily snapshot failed: ${snap} (${e.message})`);
        }
    },
    // Write to a temporary file, synced to disk, and rename it over the original, then sync the folder, so a crash or
    // power cut leaves the old file or the new one, never a short one; the previous version is kept as <name>.bak
    writejson(file, data) {
        if (this.locked.has(file)) {
            global.log.error(`Not saving ${file}, as it could not be loaded; fix or remove it and restart the bot.`);
            return false;
        }
        const tmp = `${file}.tmp`, bak = this.sibling(file, '.bak');
        try {
            const fd = fs.openSync(tmp, 'w');
            try {
                fs.writeFileSync(fd, JSON.stringify(data, null, 2));
                fs.fsyncSync(fd);
            }
            finally {
                fs.closeSync(fd);
            }
            this.snapshot(file);
            if (fs.existsSync(file)) fs.copyFileSync(file, bak);
            fs.renameSync(tmp, file);
            try {
                const dirfd = fs.openSync(path.dirname(file), 'r');
                try {
                    fs.fsyncSync(dirfd);
                }
                finally {
                    fs.closeSync(dirfd);
                }
            }
            catch { /* folders can't be opened on Windows, where the rename is already durable */ }
            this.failed.delete(file);
            return true;
        }
        catch (e) {
            global.log.error(`Saving failed: ${file} (${e.message})`);
            this.failed.set(file, data);
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
