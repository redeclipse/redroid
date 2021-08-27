const fs = require('fs');

module.exports = {
    name: 'quote',
    quotes: {},
    start() {
        global.log.out('Loading quotes: ./db/quote.json');
        const data = fs.readFileSync('./db/quote.json', 'utf-8');
        try {
            this.quotes = JSON.parse(data);
            global.log.out('Quotes loaded ' + Object.keys(this.quotes).length + ' entries.');
        }
        catch (e) {
            global.log.out(e);
        }
        return true;
    },
    shutdown() {
        // this.save();
    },
    save() {
        global.log.out('Saving quotes: ./db/quote.json');
        try {
            fs.accessSync('./db/quote.json', fs.constants.R_OK);
            try {
                fs.renameSync('./db/quote.json', './db/quote.bak');
                global.log.out('Saving quotes backup: ./db/quote.bak');
            }
            catch (e) {
                global.log.out(`Saving quotes backup failed: ./db/quote.bak (${e})`);
            }
        }
        catch (e) {
            global.log.out(`Saving quotes backup not found: ./db/quote.json (${e})`);
        }
        try {
            fs.writeFileSync('./db/quote.json', JSON.stringify(this.quotes, null, 2));
            return true;
        }
        catch (e) {
            global.log.out(`Saving quotes failed: ./db/quote.json (${e})`);
            return false;
        }
    },
    findtarg(target) {
        if (!this.quotes[target]) {
            const keys = Object.keys(this.quotes);
            if (target.slice(0, 1) === '/') {
                const regex = global.tools.strtoregex(target);
                const values = keys.filter(value => value.match(regex));
                if (values.length > 0) return values[0];
            }
            const searches = [ '^' + target + '$', '^' + target, target ];
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
    search(target, str) {
        const regex = global.tools.strtoregex(str), matches = {};
        if (target) {
            const targ = this.findtarg(target);
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
    query(target, str) {
        let result = null;
        if (str) {
            const values = this.search(target, str), keys = Object.keys(values);
            if (keys.length > 0) {
                const numt = global.tools.rand(0, keys.length);
                if (values[keys[numt]].length > 0) {
                    const numq = global.tools.rand(0, values[keys[numt]].length);
                    result = [ keys[numt], values[keys[numt]][numq] ];
                }
            }
        }
        else if (target) {
            const targ = this.findtarg(target);
            if (targ && this.quotes[targ] && this.quotes[targ].length > 0) {
                const num = global.tools.rand(0, this.quotes[targ].length);
                result = [ targ, this.quotes[targ][num] ];
            }
        }
        else {
            const keys = Object.keys(this.quotes);
            const num = global.tools.rand(0, keys.length);
            result = [ keys[num], this.lookup(keys[num]) ];
        }
        return result;
    },
    add(target, str) {
        let targ = target;
        const keys = Object.keys(this.quotes);
        const regex = new RegExp(target, 'i');
        const values = keys.filter(value => value.match(regex));
        if (values.length > 0) targ = values[0];
        if (!targ) return null;
        if (!this.quotes[targ]) this.quotes[targ] = [];
        this.quotes[targ].push(str);
        return this.quotes[targ].last();
    }
};
