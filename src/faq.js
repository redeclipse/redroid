const fs = require('fs');

module.exports = {
    name: 'faq',
    faqs: {},
    start() {
        global.log.out('Loading FAQs: ./db/faq.json');
        const data = fs.readFileSync('./db/faq.json', 'utf-8');
        try {
            this.faqs = JSON.parse(data);
            global.log.out('FAQs loaded ' + Object.keys(this.faqs).length + ' entries.');
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
        global.log.out('Saving FAQs: ./db/faq.json');
        try {
            fs.accessSync('./db/faq.json', fs.constants.R_OK);
            try {
                fs.renameSync('./db/faq.json', './db/faq.bak');
                global.log.out('Saving FAQs backup: ./db/faq.bak');
            }
            catch (e) {
                global.log.out(`Saving FAQs backup failed: ./db/faq.bak (${e})`);
            }
        }
        catch (e) {
            global.log.out(`Saving FAQs backup not found: ./db/faq.json (${e})`);
        }
        try {
            fs.writeFileSync('./db/faq.json', JSON.stringify(this.faqs, null, 2));
            return true;
        }
        catch (e) {
            global.log.out(`Saving FAQs failed: ./db/faq.json (${e})`);
            return false;
        }
    },
    findtarg(target) {
        if (!this.faqs[target]) {
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
        if (target) {
            const targ = this.findtarg(target);
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
    query(target, str) {
        let result = null;
        if (str) {
            const values = this.search(target, str), keys = Object.keys(values);
            if (keys.length > 0) {
                const numt = global.tools.rand(0, keys.length);
                if (values[keys[numt]].length > 0) {
                    result = { name: keys[numt], value: values[keys[numt]] };
                }
            }
        }
        else if (target) {
            const targ = this.findtarg(target);
            if (targ && this.faqs[targ] && this.faqs[targ].length > 0) {
                result = { name: targ, value: this.faqs[targ] };
            }
        }
        else {
            const keys = Object.keys(this.faqs);
            const num = global.tools.rand(0, keys.length);
            result = { name: keys[num], vale: this.lookup(keys[num]) };
        }
        return result;
    },
};
