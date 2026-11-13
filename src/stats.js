const tools = require('./tools'); // global.tools, which starts after this does

module.exports = {
    name: 'stats',
    data: { counts: {}, tipjar: {} },
    config: null, // config.stats
    start(bot) {
        this.config = bot.config.stats;
        if (!this.config || !this.config.file) throw new Error('Stats: config.stats.file is needed.');
        global.log.out(`Loading stats: ${this.config.file}`);
        const parsed = tools.readjson(this.config.file);
        if (parsed) {
            this.data = {
                counts: tools.isobject(parsed.counts) ? parsed.counts : {},
                tipjar: tools.isobject(parsed.tipjar) ? parsed.tipjar : {}
            };
            global.log.out('Stats loaded ' + Object.keys(this.data.counts).length + ' counters and ' + Object.keys(this.data.tipjar).length + ' tipjar entries.');
        }
        return true;
    },
    shutdown() {
        // this.save();
    },
    save() {
        global.log.out(`Saving stats: ${this.config.file}`);
        return global.tools.writejson(this.config.file, this.data);
    },
    get(key) {
        return this.data.counts[key] || 0;
    },
    inc(key, amount = 1) {
        this.data.counts[key] = (this.data.counts[key] || 0) + amount;
        this.save();
        return this.data.counts[key];
    },
    milestone(count, label) {
        if (this.config && this.config.milestone > 0 && count > 0 && count % this.config.milestone === 0) {
            return `This was the ${count}th ${label}.`;
        }
        return null;
    },
    findtip(target) {
        if (!target) return null;
        if (Object.hasOwn(this.data.tipjar, target)) return target;
        const lower = target.toLowerCase();
        for (const key of Object.keys(this.data.tipjar)) {
            if (key.toLowerCase() === lower) return key;
        }
        if (global.users) {
            const ukey = global.users.findkey(target, true);
            if (ukey) {
                if (Object.hasOwn(this.data.tipjar, ukey)) return ukey;
                const ulower = ukey.toLowerCase();
                for (const key of Object.keys(this.data.tipjar)) {
                    if (key.toLowerCase() === ulower) return key;
                }
            }
        }
        return null;
    },
    gettip(target) {
        const key = this.findtip(target);
        return key ? this.data.tipjar[key] : 0;
    },
    addtip(target, amount = 1) {
        const key = this.findtip(target) || (global.users && global.users.findkey(target, true)) || target;
        this.data.tipjar[key] = (this.data.tipjar[key] || 0) + amount;
        if (!this.save()) throw 'The change was made but could not be saved to disk, it will be lost on restart.';
        return { name: key, value: this.data.tipjar[key] };
    }
};
