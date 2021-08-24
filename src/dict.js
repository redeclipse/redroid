const fs = require('fs');

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
    save() {
        for (const word of this.list) {
            console.log(`Saving dictionary: ./dict/${word}.json`);
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
    lookup(word, index = -1) {
        if (typeof this.words[word] === undefined || this.words[word] === null) return null;
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
