const fs = require('fs');

module.exports = {
    name: 'dict',
    list: [ 'action', 'adverb', 'answer', 'consult', 'disease', 'insert', 'killed', 'object', 'orifice', 'region', 'style', 'transmit', 'verb', 'weapon' ],
    words: {},
    start() {
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
    shutdown() {
        for (const word of this.list) {
            console.log(`Saving dictionary: ./dict/${word}.json`);
            try {
                fs.accessSync(`./dict/${word}.json`, fs.constants.R_OK);
                try {
                    fs.renameSync(`./dict/${word}.json`, `./dict/${word}.bak`);
                    console.log(`Saving backup: ./dict/${word}.bak`);
                }
                catch (e) {
                    console.log(`Failed to save backup: ./dict/${word}.bak`);
                }
            }
            catch (e) {
                console.log(`Original dictionary not found: ./dict/${word}.json`);
            }
            fs.writeFileSync(`./dict/${word}.json`, JSON.stringify(this.words[word], null, 2));
        }
        return true;
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
