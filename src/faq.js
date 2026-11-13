const tools = require('./tools'); // global.tools, which starts after this does

module.exports = {
    name: 'faq',
    faqs: {},
    file: null, // config.faq.file
    start(bot) {
        this.file = (bot.config.faq || {}).file;
        if (!this.file) throw new Error('FAQ: config.faq.file is needed.');
        global.log.out(`Loading FAQs: ${this.file}`);
        const parsed = tools.readjson(this.file, data => tools.isobject(data) && Object.values(data).every(Array.isArray));
        if (parsed) {
            this.faqs = parsed;
            global.log.out('FAQs loaded ' + Object.keys(this.faqs).length + ' entries.');
        }
        return true;
    },
    shutdown() {
        // this.save();
    },
    save() {
        global.log.out(`Saving FAQs: ${this.file}`);
        return global.tools.writejson(this.file, this.faqs);
    },
    findtarg(target, level = 0) {
        if (!this.faqs[target]) {
            if (global.users && target.slice(0, 1) !== '/') {
                const ukey = global.users.findkey(target, true);
                if (ukey) {
                    if (this.faqs[ukey]) return ukey;
                    const ulower = ukey.toLowerCase();
                    const hit = Object.keys(this.faqs).find(k => k.toLowerCase() === ulower);
                    if (hit) return hit;
                }
            }
            const keys = Object.keys(this.faqs);
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
                            const fkey = this.faqs[ukey] ? ukey : keys.find(k => k.toLowerCase() === ukey.toLowerCase());
                            if (fkey && (ukey.match(regex) || entry.aliases.some(a => a.match(regex)))) {
                                return fkey;
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
            if (targ && this.faqs[targ]) {
                const values = this.faqs[targ].filter(value => value.match(regex));
                if (values && values.length > 0) matches[targ] = values;
            }
        }
        else {
            const keys = Object.keys(this.faqs);
            for (const targ of keys) {
                const values = this.faqs[targ].filter(value => value.match(regex));
                if (values && values.length > 0) matches[targ] = values;
            }
        }
        return matches;
    },
    lookup(target) {
        if (!this.faqs[target]) return null;
        return this.faqs[target];
    },
    query(target, str, level = 0) {
        let result = null;
        if (str) {
            const values = this.search(target, str, level), keys = Object.keys(values);
            if (keys.length > 0) {
                const numt = global.tools.rand(0, keys.length);
                if (values[keys[numt]].length > 0) {
                    result = { name: keys[numt], value: values[keys[numt]] };
                }
            }
        }
        else if (target) {
            const targ = this.findtarg(target, level);
            if (targ && this.faqs[targ] && this.faqs[targ].length > 0) {
                result = { name: targ, value: this.faqs[targ] };
            }
        }
        else {
            const keys = Object.keys(this.faqs);
            if (!keys.length) return null; // none loaded
            const num = global.tools.rand(0, keys.length);
            result = { name: keys[num], value: this.lookup(keys[num]) };
        }
        return result;
    },
};
