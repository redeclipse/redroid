const fs = require('fs');

module.exports = {
    name: 'dict',
    list: [ 'action', 'adverb', 'answer', 'assault', 'consult', 'disease', 'insert', 'killed', 'object', 'orifice', 'region', 'sex', 'stfu', 'style', 'transmit', 'verb', 'weapon' ],
    words: {},
    config: null, // config.dict: where the dictionaries are, and who may change them
    start(bot) {
        this.config = bot.config.dict;
        if (!this.config || !this.config.dir) throw new Error('Dict: config.dict is needed.');
        for (const word of this.list) {
            global.log.out(`Loading dictionary: ${this.config.dir}/${word}.json`);
            try {
                const data = fs.readFileSync(`${this.config.dir}/${word}.json`, 'utf-8');
                if (!data) throw `Error reading ${word} dictionary.`;
                this.words[word] = JSON.parse(data);
                global.log.out(`Dictionary '${word}' loaded ` + this.words[word].length + ' entries.');
            }
            catch (e) {
                global.log.error(e);
                this.words[word] = [];
            }
        }
        return true;
    },
    shutdown() {
        // for (const word of this.list) this.save(word);
    },
    save(word) {
        global.log.out(`Saving dictionary: ${this.config.dir}/${word}.json`);
        return global.tools.writejson(`${this.config.dir}/${word}.json`, this.words[word]);
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
        if (!this.words[word]) throw `Invalid dictionary '${word}'. Valid dictionaries are: ${this.print()}`;
    },
    search(word, str, level = 0) {
        this.check(word);
        const regex = global.tools.strtoregex(str, level);
        return this.words[word].filter(value => value.match(regex));
    },
    lookup(word, index = -1) {
        this.check(word);
        const num = index >= 0 ? index : global.tools.rand(0, this.words[word].length);
        return this.words[word][num];
    },
    query(word, user, target, question = null, random = null) {
        this.check(word);
        let data = this.lookup(word);
        // Replacer functions, so '$' sequences in user text are not treated as patterns
        data = data.replace(/@u/g, () => `<@${user.id}>`).replace(/@n/g, () => `<@${target.id}>`);
        if (random) data = data.replace(/@r/g, () => `<@${random.id}>`);
        if (question) data = data.replace(/@q/g, () => question);
        return data;
    },
    add(word, str) {
        this.check(word);
        const data = this.words[word].filter(value => value === str);
        if (data && data.length > 0) throw `Dictionary '${word}'' already has '${str}'.'`;
        this.words[word].push(str);
        if (!this.save(word)) throw 'The change was made but could not be saved to disk, it will be lost on restart.';
        return this.words[word][this.words[word].length - 1];
    },
    remove(word, list) {
        this.check(word);
        const len = this.words[word].length;
        const data = this.words[word].filter(value => !list.includes(value));
        if (data.length <= 0) throw 'Remove request reduces dictionary to zero.';
        this.words[word] = data;
        if (!this.save(word)) throw 'The change was made but could not be saved to disk, it will be lost on restart.';
        return len - this.words[word].length;
    },
};
