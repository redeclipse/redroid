const tools = require('./tools'); // global.tools, which starts after this does

module.exports = {
    name: 'quote',
    quotes: {},
    file: null, // config.quote.file
    start(bot) {
        this.file = (bot.config.quote || {}).file;
        if (!this.file) throw new Error('Quote: config.quote.file is needed.');
        global.log.out(`Loading quotes: ${this.file}`);
        const parsed = tools.readjson(this.file, data => tools.isobject(data) && Object.values(data).every(Array.isArray));
        if (parsed) {
            this.quotes = parsed;
            global.log.out('Quotes loaded ' + Object.keys(this.quotes).length + ' entries.');
        }
        return true;
    },
    shutdown() {
        // this.save();
    },
    save() {
        global.log.out(`Saving quotes: ${this.file}`);
        return global.tools.writejson(this.file, this.quotes);
    },
    findtarg(target, level = 0) {
        if (!this.quotes[target]) {
            if (global.users && target.slice(0, 1) !== '/') {
                const ukey = global.users.findkey(target, true);
                if (ukey && this.quotes[ukey]) return ukey;
            }
            const keys = Object.keys(this.quotes);
            if (target.slice(0, 1) === '/') {
                const regex = global.tools.strtoregex(target, level);
                const values = keys.filter(value => value.match(regex));
                if (values.length > 0) return values[0];
            }
            const escaped = global.tools.escaperegex(target), searches = [ '^' + escaped + '$', '^' + escaped, escaped ];
            for (let i = 0; i < 2; i++) {
                for (const search of searches) {
                    const regex = i != 0 ? new RegExp(search, 'i') : new RegExp(search);
                    const values = keys.filter(value => value.match(regex));
                    if (values.length > 0) return values[0];
                    if (global.users) {
                        for (const [ ukey, entry ] of Object.entries(global.users.users)) {
                            if (this.quotes[ukey] && (ukey.match(regex) || entry.aliases.some(a => a.match(regex)))) {
                                return ukey;
                            }
                        }
                    }
                }
            }
        }
        return target;
    },
    search(target, str, level = 0) {
        const regex = global.tools.strtoregex(str, level), matches = {};
        if (target) {
            const targ = this.findtarg(target, level);
            if (targ && this.quotes[targ]) {
                const values = this.quotes[targ].filter(value => value.body.match(regex));
                if (values && values.length > 0) matches[targ] = values;
            }
        }
        else {
            const keys = Object.keys(this.quotes);
            for (const targ of keys) {
                const values = this.quotes[targ].filter(value => value.body.match(regex));
                if (values && values.length > 0) matches[targ] = values;
            }
        }
        return matches;
    },
    lookup(target, index = -1) {
        if (!this.quotes[target]) return null;
        const num = index >= 0 ? index : global.tools.rand(0, this.quotes[target].length);
        return this.quotes[target][num];
    },
    query(target, str, level = 0) {
        let result = null;
        if (str) {
            const values = this.search(target, str, level), keys = Object.keys(values);
            if (keys.length > 0) {
                const numt = global.tools.rand(0, keys.length);
                const key = keys[numt];
                if (values[key].length > 0) {
                    const numq = global.tools.rand(0, values[key].length);
                    const value = values[key][numq];
                    const list = this.quotes[key];
                    result = { name: key, value, index: list.indexOf(value) + 1, total: list.length };
                }
            }
        }
        else if (target) {
            const targ = this.findtarg(target, level);
            if (targ && this.quotes[targ] && this.quotes[targ].length > 0) {
                const list = this.quotes[targ];
                const num = global.tools.rand(0, list.length);
                result = { name: targ, value: list[num], index: num + 1, total: list.length };
            }
        }
        else {
            const keys = Object.keys(this.quotes);
            if (!keys.length) return null;
            const key = keys[global.tools.rand(0, keys.length)];
            const list = this.quotes[key];
            if (!list || !list.length) return null; // none loaded, or a name with no quotes left
            const num = global.tools.rand(0, list.length);
            result = { name: key, value: list[num], index: num + 1, total: list.length };
        }
        return result;
    },
    add(target, str, type = 'msg') {
        let targ = (global.users && global.users.findkey(target, true)) || target;
        if (!this.quotes[targ]) {
            const keys = Object.keys(this.quotes);
            const regex = new RegExp('^' + global.tools.escaperegex(targ) + '$', 'i');
            const values = keys.filter(value => value.match(regex));
            if (values.length > 0) targ = values[0];
        }
        if (!targ) return null;
        if (!this.quotes[targ]) this.quotes[targ] = [];
        this.quotes[targ].push({ body: str, type: type });
        if (!this.save()) throw 'The change was made but could not be saved to disk, it will be lost on restart.';
        return this.quotes[targ].at(-1);
    }
};
