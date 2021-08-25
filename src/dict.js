const fs = require('fs');

module.exports = {
    name: 'dict',
    list: [ 'action', 'adverb', 'answer', 'consult', 'disease', 'insert', 'killed', 'object', 'orifice', 'region', 'style', 'transmit', 'verb', 'weapon' ],
    words: {},
    start() {
        for (const word of this.list) {
            console.log(`Loading dictionary: ./db/dict/${word}.json`);
            const data = fs.readFileSync(`./db/dict/${word}.json`, 'utf-8');
            try {
                this.words[word] = JSON.parse(data);
                console.log(`Dictionary '${word}' loaded ` + this.words[word].length + ' entries.');
            }
            catch (e) {
                console.log(e);
                this.words[word] = [];
            }
        }
        return true;
    },
    shutdown() {
        // for (const word of this.list) this.save(word);
    },
    save(word) {
        console.log(`Saving dictionary: ./db/dict/${word}.json`);
        try {
            fs.accessSync(`./db/dict/${word}.json`, fs.constants.R_OK);
            try {
                fs.renameSync(`./db/dict/${word}.json`, `./db/dict/${word}.bak`);
                console.log(`Saving dictionary backup: ./db/dict/${word}.bak`);
            }
            catch (e) {
                console.log(`Saving dictionary backup failed: ./db/dict/${word}.bak (${e})`);
            }
        }
        catch (e) {
            console.log(`Saving dictionary backup not found: ./db/dict/${word}.json (${e})`);
        }
        try {
            fs.writeFileSync(`./db/dict/${word}.json`, JSON.stringify(this.words[word], null, 2));
            return true;
        }
        catch (e) {
            console.log(`Saving dictionary failed: ./db/dict/${word}.json (${e})`);
            return false;
        }
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
    search(word, str) {
        if (typeof this.words[word] === 'undefined' || this.words[word] === null) return [];
        const regex = global.tools.strtoregex(str);
        return this.words[word].filter(value => value.match(regex));
    },
    lookup(word, index = -1) {
        if (typeof this.words[word] === 'undefined' || this.words[word] === null) return null;
        const num = index >= 0 ? index : global.tools.rand(0, this.words[word].length);
        return this.words[word][num];
    },
    query(word, user, target, question = null) {
        let data = this.lookup(word);
        if (data === null) return null;
        data = data.replace(/@u/g, `<@${user.id}>`).replace(/@n/g, `<@${target.id}>`);
        if (question !== null) data = data.replace(/@q/g, question);
        return data;
    }
};
