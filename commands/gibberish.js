const { ApplicationCommandOptionType } = require('discord.js');

const CONSONANTS = [ 'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z' ];
const VOWELS = [ 'a', 'e', 'i', 'o', 'u', 'y' ];
const MAX_GIBBERISH_LEN = 400;

module.exports = {
    config: {
        chat: {
            name: 'gibberish',
            description: 'Generates random pronounceable gibberish.',
            options: [
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: 'words',
                    description: 'Number of words (1-32).',
                    required: false,
                    min_value: 1,
                    max_value: 32
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: 'minlen',
                    description: 'Minimum word length (1-16).',
                    required: false,
                    min_value: 1,
                    max_value: 16
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: 'maxlen',
                    description: 'Maximum word length (1-16).',
                    required: false,
                    min_value: 1,
                    max_value: 16
                }
            ]
        }
    },
    gibber(len) {
        let out = '', c = 0, v = 0;
        for (let i = 0; i < len; i++) {
            const pickconsonant = c >= 2 ? false : (v >= global.tools.rand(1, 3) ? true : global.tools.rand(0, 2) === 1);
            if (!pickconsonant) {
                out += VOWELS[global.tools.rand(0, VOWELS.length)];
                v++;
                c = 0;
            }
            else {
                out += CONSONANTS[global.tools.rand(0, CONSONANTS.length)];
                c++;
                v = 0;
            }
        }
        return out;
    },
    async execute(bot, action) {
        const words = action.options.getInteger('words') || global.tools.rand(1, 33);
        const minopt = action.options.getInteger('minlen');
        const maxopt = action.options.getInteger('maxlen');
        const count = global.stats.inc('gibberish'), mile = global.stats.milestone(count, 'line of gibberish babbled');

        let out = '';
        for (let i = 0; i < words; i++) {
            let targetmax;
            if (minopt && maxopt) {
                const lo = Math.min(minopt, maxopt), hi = Math.max(minopt, maxopt);
                targetmax = global.tools.rand(lo, hi + 1);
            }
            else if (minopt) {
                targetmax = global.tools.rand(1, minopt + 1);
            }
            else if (maxopt) {
                targetmax = global.tools.rand(1, maxopt + 1);
            }
            else {
                targetmax = global.tools.rand(1, 17);
            }
            const wlen = global.tools.rand(1, targetmax + 1);
            const word = this.gibber(wlen);
            out = out ? `${out} ${word}` : word;
            if (out.length >= MAX_GIBBERISH_LEN) break;
        }

        const embed = {
            color: 0x8888ff,
            title: '🤪 Gibberish',
            description: out
        };
        if (mile) embed.footer = { text: mile };
        await action.reply({ embeds: [ embed ] });
    },
};
