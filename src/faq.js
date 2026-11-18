const tools = require('./tools'); // global.tools, which starts after this does

module.exports = {
    name: 'faq',
    faqs: {},
    file: null, // config.faq.file
    config: null, // config.faq: where the FAQ is, and who may change it
    start(bot) {
        this.config = bot.config.faq;
        this.file = (this.config || {}).file;
        if (!this.file) throw new Error('FAQ: config.faq.file is needed.');
        for (const key of [ 'level_add', 'level_remove', 'level_mass', 'buttonttl' ]) {
            if (typeof this.config[key] !== 'number') throw new Error(`FAQ: config.faq.${key} is needed.`);
        }
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
                if (targ.match(regex)) {
                    matches[targ] = this.faqs[targ];
                }
                else {
                    const values = this.faqs[targ].filter(value => value.match(regex));
                    if (values && values.length > 0) matches[targ] = values;
                }
            }
        }
        return matches;
    },
    lookup(target) {
        if (!this.faqs[target]) return null;
        return this.faqs[target];
    },
    // The stored topic for a name, matched exactly ignoring case; changes never match loosely
    topic(name) {
        if (!name) return null;
        if (Object.hasOwn(this.faqs, name)) return name;
        const lower = name.toLowerCase();
        return Object.keys(this.faqs).find(k => k.toLowerCase() === lower) || null;
    },
    add(topic, answer) {
        const targ = this.topic(topic) || topic;
        const list = this.faqs[targ] || [];
        if (list.includes(answer)) throw `FAQ '${targ}' already has that answer.`;
        list.push(answer);
        this.faqs[targ] = list;
        if (!this.save()) throw 'The change was made but could not be saved to disk, it will be lost on restart.';
        return { topic: targ, index: list.length, created: list.length === 1 };
    },
    // Removes the listed answers from a topic, or the whole topic with no list; a topic left with no answers goes too
    remove(topic, list = null) {
        if (!this.faqs[topic]) throw `There is no FAQ '${topic}'.`;
        const len = this.faqs[topic].length;
        const data = list ? this.faqs[topic].filter(value => !list.includes(value)) : [];
        if (data.length > 0) this.faqs[topic] = data;
        else delete this.faqs[topic];
        if (!this.save()) throw 'The change was made but could not be saved to disk, it will be lost on restart.';
        return len - data.length;
    },
    query(target, str, level = 0) {
        let result = null;
        const allkeys = Object.keys(this.faqs);
        if (str) {
            const values = this.search(target, str, level), keys = Object.keys(values);
            if (keys.length > 0) {
                if (target || keys.length === 1) {
                    if (values[keys[0]].length > 0) result = { name: keys[0], value: values[keys[0]], index: allkeys.indexOf(keys[0]) + 1, total: allkeys.length };
                }
                else {
                    const exact = str.slice(0, 1) !== '/' ? keys.find(k => k.toLowerCase() === str.toLowerCase()) : null;
                    if (exact) result = { name: exact, value: values[exact], index: allkeys.indexOf(exact) + 1, total: allkeys.length, also: keys.filter(k => k !== exact) };
                    else result = { name: null, matches: values, total: allkeys.length };
                }
            }
        }
        else if (target) {
            const targ = this.findtarg(target, level);
            if (targ && this.faqs[targ] && this.faqs[targ].length > 0) {
                result = { name: targ, value: this.faqs[targ], index: allkeys.indexOf(targ) + 1, total: allkeys.length };
            }
        }
        else {
            if (!allkeys.length) return null; // none loaded
            const num = global.tools.rand(0, allkeys.length);
            result = { name: allkeys[num], value: this.lookup(allkeys[num]), index: num + 1, total: allkeys.length };
        }
        return result;
    },
};
