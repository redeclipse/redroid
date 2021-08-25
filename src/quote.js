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
        if (typeof target !== 'undefined' && target !== null && target !== '') {
            const targ = this.findtarg(target);
            if (targ !== null && targ !== '' && typeof this.quotes[targ] !== 'undefined' && this.quotes[targ] !== null) {
                const values = this.quotes[targ].filter(value => value.match(regex));
                if (values !== null && values.length > 0) matches[targ] = values;
            }
        }
        else {
            const keys = Object.keys(this.quotes);
            for (const targ of keys) {
                const values = this.quotes[targ].filter(value => value.match(regex));
                if (values !== null && values.length > 0) matches[targ] = values;
            }
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
            const values = this.search(target, str), keys = Object.keys(values);
            console.log(JSON.stringify(values, null, 2));
            if (keys.length > 0) {
                const numt = global.tools.rand(0, keys.length);
                if (values[keys[numt]].length > 0) {
                    const numq = global.tools.rand(0, values[keys[numt]].length);
                    result = [ keys[numt], values[keys[numt]][numq] ];
                }
            }
        }
        else if (typeof target !== 'undefined' && target !== null && target !== '') {
            const targ = this.findtarg(target);
            if (targ !== null && targ !== '' && typeof this.quotes[targ] !== 'undefined' && this.quotes[targ].length > 0) {
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
};
