const fs = require('fs');

module.exports = {
    name: 'dict',
    list: [ 'action', 'adverb', 'answer', 'consult', 'disease', 'insert', 'killed', 'object', 'orifice', 'region', 'stfu', 'style', 'transmit', 'verb', 'weapon' ],
    words: {},
    start() {
        for (const word of this.list) {
            global.log.out(`Loading dictionary: ./db/dict/${word}.json`);
            const data = fs.readFileSync(`./db/dict/${word}.json`, 'utf-8');
            try {
                this.words[word] = JSON.parse(data);
                global.log.out(`Dictionary '${word}' loaded ` + this.words[word].length + ' entries.');
            }
            catch (e) {
                global.log.out(e);
                this.words[word] = [];
            }
        }
        return true;
    },
    shutdown() {
        // for (const word of this.list) this.save(word);
    },
    save(word) {
        global.log.out(`Saving dictionary: ./db/dict/${word}.json`);
        try {
            fs.writeFileSync(`./db/dict/${word}.json`, JSON.stringify(this.words[word], null, 2));
            return true;
        }
        catch (e) {
            global.log.out(`Saving dictionary failed: ./db/dict/${word}.json (${e})`);
            return false;
        }
    },
    choices() {
        let result = []; // eslint-disable-line prefer-const
        for (const word of this.list) {
            const data = { name: word, value: word };
            result.push(data);
        }
        return result;
    },
    print(sep = ', ') {
        let dosep = false, result = '';
        for (const word of this.list) {
            if (dosep) result += sep;
            result += word;
            dosep = true;
        }
        return result;
    },
    check(word) {
        if (!word) throw `No dictionary name provided. Valid dictionaries are: ${this.print()}`;
        if (!this.words[word]) throw `Invalid dictionary '${word}''. Valid dictionaries are: ${this.print()}`;
    },
    search(word, str) {
        this.check(word);
        const regex = global.tools.strtoregex(str);
        return this.words[word].filter(value => value.match(regex));
    },
    lookup(word, index = -1) {
        this.check(word);
        const num = index >= 0 ? index : global.tools.rand(0, this.words[word].length);
        return this.words[word][num];
    },
    query(word, user, target, question = null) {
        this.check(word);
        let data = this.lookup(word);
        data = data.replace(/@u/g, `<@${user.id}>`).replace(/@n/g, `<@${target.id}>`);
        if (question) data = data.replace(/@q/g, question);
        return data;
    },
    add(word, str) {
        this.check(word);
        const data = this.words[word].filter(value => value === str);
        if (data && data.length > 0) throw `Dictionary '${word}'' already has '${str}'.'`;
        this.words[word].push(str);
        this.save(word);
        return this.words[word][this.words[word].length - 1];
    },
    remove(word, str) {
        this.check(word);
        let data = [];
        if (str[0] == '/') {
            const regex = global.tools.strtoregex(str);
            data = this.words[word].filter(value => value.match(regex));
        }
        else { data = this.words[word].filter(value => value === str); }
        if (data.length < 1) throw `Dictionary '${word}' has no matches for '${str}'.`;
        if (data.length > 1) throw `Too many matches in '${word}'' for '${str}' (${data.length}).`; // TODO: add ability to confirm mass deletes
        let narr = [];
        if (str[0] == '/') {
            const regex = global.tools.strtoregex(str);
            narr = this.words[word].filter(value => !value.match(regex));
        }
        else { narr = this.words[word].filter(value => value !== str); }
        this.words[word] = narr;
        this.save(word);
        return data;
    },
};
