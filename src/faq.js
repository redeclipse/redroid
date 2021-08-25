const fs = require('fs');

module.exports = {
    name: 'faq',
    faqs: {},
    start() {
        console.log('Loading FAQs: ./db/faq.json');
        const data = fs.readFileSync('./db/faq.json', 'utf-8');
        try {
            this.faqs = JSON.parse(data);
            console.log('FAQs loaded ' + Object.keys(this.faqs).length + ' entries.');
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
        console.log('Saving FAQs: ./db/faq.json');
        try {
            fs.accessSync('./db/faq.json', fs.constants.R_OK);
            try {
                fs.renameSync('./db/faq.json', './db/faq.bak');
                console.log('Saving FAQs backup: ./db/faq.bak');
            }
            catch (e) {
                console.log(`Saving FAQs backup failed: ./db/faq.bak (${e})`);
            }
        }
        catch (e) {
            console.log(`Saving FAQs backup not found: ./db/faq.json (${e})`);
        }
        try {
            fs.writeFileSync('./db/faq.json', JSON.stringify(this.faqs, null, 2));
            return true;
        }
        catch (e) {
            console.log(`Saving FAQs failed: ./db/faq.json (${e})`);
            return false;
        }
    },
    findtarg(target) {
        if (typeof this.faqs[target] === 'undefined' || this.faqs[target] === null) {
            const keys = Object.keys(this.faqs);
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
            if (targ !== null && targ !== '' && typeof this.faqs[targ] !== 'undefined' && this.faqs[targ] !== null) {
                const values = this.faqs[targ].filter(value => value.match(regex));
                if (values !== null && values.length > 0) matches[targ] = values;
            }
        }
        else {
            const keys = Object.keys(this.faqs);
            for (const targ of keys) {
                const values = this.faqs[targ].filter(value => value.match(regex));
                if (values !== null && values.length > 0) matches[targ] = values;
            }
        }
        return matches;
    },
    lookup(target) {
        if (typeof this.faqs[target] === 'undefined' || this.faqs[target] === null) return null;
        return this.faqs[target];
    },
    query(target, str) {
        let result = null;
        if (typeof str !== 'undefined' && str !== null && str !== '') {
            const values = this.search(target, str), keys = Object.keys(values);
            if (keys.length > 0) {
                const numt = global.tools.rand(0, keys.length);
                if (values[keys[numt]].length > 0) {
                    result = [ keys[numt], values[keys[numt]] ];
                }
            }
        }
        else if (typeof target !== 'undefined' && target !== null && target !== '') {
            const targ = this.findtarg(target);
            if (targ !== null && targ !== '' && typeof this.faqs[targ] !== 'undefined' && this.faqs[targ].length > 0) {
                result = [ targ, this.faqs[targ] ];
            }
        }
        else {
            const keys = Object.keys(this.faqs);
            const num = global.tools.rand(0, keys.length);
            result = [ keys[num], this.lookup(keys[num]) ];
        }
        return result;
    },
};
