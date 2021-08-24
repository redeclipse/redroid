const fs = require('fs');
const tools = require('../lib/tools.js');

module.exports = {
    list: [ 'action', 'adverb', 'answer', 'consult', 'disease', 'insert', 'killed', 'object', 'orifice', 'region', 'style', 'transmit', 'verb', 'weapon' ],
    words: {},
    init() {
        for (const word of this.list) {
            console.log(`Loading dictionary: ./dict/${word}.json`);
            const data = fs.readFileSync(`./dict/${word}.json`, 'utf-8');
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
    lookup(word, index) {
        if (typeof this.words[word] === undefined || this.words[word] === null) return null;
        const num = index >= 0 ? index : tools.rand(0, this.words[word].length);
        return this.words[word][num];
    },
    query(word, index, user, target, question = null) {
        const data = this.lookup(word, index);
        if (data === null) return null;
        data.replace(/@u/g, user).replace(/@n/g, target);
        if (question !== null) data.replace(/@q/g, question);
        return data;
    }
};
