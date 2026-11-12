const fs = require('fs');

module.exports = {
    name: 'quote',
    quotes: {},
    start() {
        global.log.out('Loading quotes: ./db/quote.json');
        try {
            this.quotes = JSON.parse(fs.readFileSync('./db/quote.json', 'utf-8'));
            global.log.out('Quotes loaded ' + Object.keys(this.quotes).length + ' entries.');
        }
        catch (e) {
            global.log.error(e);
        }
        return true;
    },
    shutdown() {
        // this.save();
    },
    save() {
        global.log.out('Saving quotes: ./db/quote.json');
        return global.tools.writejson('./db/quote.json', this.quotes);
    },
    findtarg(target, level = 0) {
        if (!this.quotes[target]) {
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
                const values = this.quotes[targ].filter(value => value.match(regex));
                if (values && values.length > 0) matches[targ] = values;
            }
        }
        else {
            const keys = Object.keys(this.quotes);
            for (const targ of keys) {
                const values = this.quotes[targ].filter(value => value.match(regex));
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
                if (values[keys[numt]].length > 0) {
                    const numq = global.tools.rand(0, values[keys[numt]].length);
                    result = { name: keys[numt], value: values[keys[numt]][numq] };
                }
            }
        }
        else if (target) {
            const targ = this.findtarg(target, level);
            if (targ && this.quotes[targ] && this.quotes[targ].length > 0) {
                const num = global.tools.rand(0, this.quotes[targ].length);
                result = { name: targ, value: this.quotes[targ][num] };
            }
        }
        else {
            const keys = Object.keys(this.quotes);
            const num = global.tools.rand(0, keys.length), value = keys.length ? this.lookup(keys[num]) : undefined;
            if (value === undefined) return null; // none loaded, or a name with no quotes left
            result = { name: keys[num], value };
        }
        return result;
    },
    add(target, str) {
        let targ = target;
        const keys = Object.keys(this.quotes);
        const regex = new RegExp(global.tools.escaperegex(target), 'i');
        const values = keys.filter(value => value.match(regex));
        if (values.length > 0) targ = values[0];
        if (!targ) return null;
        if (!this.quotes[targ]) this.quotes[targ] = [];
        this.quotes[targ].push(str);
        return this.quotes[targ].at(-1);
    }
};
