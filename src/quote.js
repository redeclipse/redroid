const fs = require('fs');

module.exports = {
    name: 'quote',
    quotes: {},
    start() {
        console.log('Loading quotes: ./db/quote.json');
        const data = fs.readFileSync('./db/quote.json', 'utf-8');
        try {
            this.quotes = JSON.parse(data);
            console.log('Quotes loaded ' + Object.keys(this.quotes).length + ' entries.');
        }
        catch (e) {
            console.log(e);
        }
        return true;
    },
    shutdown() {
        // this.save();
    },
    save() {
        console.log('Saving quotes: ./db/quote.json');
        try {
            fs.accessSync('./db/quote.json', fs.constants.R_OK);
            try {
                fs.renameSync('./db/quote.json', './db/quotes.bak');
                console.log('Saving quotes backup: ./db/quotes.bak');
            }
            catch (e) {
                console.log(`Saving quotes backup failed: ./db/quotes.bak (${e})`);
            }
        }
        catch (e) {
            console.log(`Saving quotes backup not found: ./db/quote.json (${e})`);
        }
        try {
            fs.writeFileSync('./db/quote.json', JSON.stringify(this.quotes, null, 2));
            return true;
        }
        catch (e) {
            console.log(`Saving quotes failed: ./db/quote.json (${e})`);
            return false;
        }
    },
    findtarg(target) {
        if (typeof this.quotes[target] === 'undefined' || this.quotes[target] === null) {
            const targ = target.toLowerCase();
            if (typeof this.quotes[targ] === 'undefined' || this.quotes[targ] === null) return null;
            return targ;
        }
        return target;
    },
    search(target, str) {
        const regex = global.tools.strtoregex(str);
        if (typeof target !== 'undefined' && target !== null && target !== '') {
            const targ = this.findtarget(target);
            if (targ === null) return null;
            return this.quotes[targ].filter(value => value.match(regex));
        }
        const keys = Object.keys(this.quotes), matches = [];
        for (const targ of keys) {
            const values = this.quotes[targ].filter(value => value.match(regex));
            if (values !== null) matches.push(...values);
        }
        return matches;
    },
    lookup(target, index = -1) {
        if (typeof this.quotes[target] === 'undefined' || this.quotes[target] === null) return null;
        const num = index >= 0 ? index : global.tools.rand(0, this.quotes[target].length);
        return this.quotes[target][num];
    },
    query(target, str) {
        let result = null;
        if (typeof str !== 'undefined' && str !== null && str !== '') {
            const values = this.search(target, str);
            const num = global.tools.rand(0, values.length);
            result = [ target ];
            result.push(values[num]);
        }
        else if (typeof target !== 'undefined' && target !== null && target !== '') {
            const targ = this.findtarg(target);
            if (targ === null) return null;
            const num = global.tools.rand(0, this.quotes[targ].length);
            result = [ targ ];
            result.push(this.quotes[targ][num]);
        }
        else {
            const keys = Object.keys(this.quotes);
            const num = global.tools.rand(0, keys.length);
            result = [ keys[num] ];
            result.push(this.lookup(keys[num]));
        }
        return result;
    },
};
