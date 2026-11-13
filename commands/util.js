const dns = require('dns').promises;
const net = require('net');
const { ApplicationCommandOptionType, escapeMarkdown } = require('discord.js');

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const evalmath = (expr) => {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
        const ch = expr[i];
        if (/\s/.test(ch)) {
            i++;
            continue;
        }
        if ('+-*/%^()'.includes(ch)) {
            tokens.push(ch);
            i++;
            continue;
        }
        const m = expr.slice(i).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
        if (m) {
            tokens.push(Number(m[0]));
            i += m[0].length;
            continue;
        }
        throw `Unexpected character '${ch}' in expression.`;
    }
    if (!tokens.length) throw 'Empty expression.';
    let pos = 0;
    const parseExpr = () => {
        let left = parseTerm();
        while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
            const op = tokens[pos++];
            const right = parseTerm();
            left = op === '+' ? left + right : left - right;
        }
        return left;
    };
    const parseTerm = () => {
        let left = parsePower();
        while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/' || tokens[pos] === '%')) {
            const op = tokens[pos++];
            const right = parsePower();
            if ((op === '/' || op === '%') && right === 0) throw 'Division by zero.';
            left = op === '*' ? left * right : (op === '/' ? left / right : left % right);
        }
        return left;
    };
    const parsePower = () => {
        const base = parseUnary();
        if (pos < tokens.length && tokens[pos] === '^') {
            pos++;
            const exp = parsePower();
            return Math.pow(base, exp);
        }
        return base;
    };
    const parseUnary = () => {
        if (tokens[pos] === '+') {
            pos++;
            return parseUnary();
        }
        if (tokens[pos] === '-') {
            pos++;
            return -parseUnary();
        }
        return parsePrimary();
    };
    const parsePrimary = () => {
        if (pos >= tokens.length) throw 'Unexpected end of expression.';
        const tok = tokens[pos++];
        if (tok === '(') {
            const val = parseExpr();
            if (tokens[pos++] !== ')') throw 'Missing closing parenthesis.';
            return val;
        }
        if (typeof tok === 'number') return tok;
        throw `Unexpected token '${tok}'.`;
    };
    const result = parseExpr();
    if (pos < tokens.length) throw `Unexpected token '${tokens[pos]}'.`;
    return result;
};

const parsebase = (str, base) => {
    const clean = str.trim().toUpperCase();
    if (!clean) throw 'Empty value.';
    const neg = clean.startsWith('-');
    const body = neg || clean.startsWith('+') ? clean.slice(1) : clean;
    if (!body) throw 'Invalid number.';
    let val = 0n;
    const b = BigInt(base);
    for (const ch of body) {
        const idx = DIGITS.indexOf(ch);
        if (idx < 0 || idx >= base) throw `Invalid digit '${ch}' for base ${base}.`;
        val = val * b + BigInt(idx);
    }
    return neg ? -val : val;
};

const formatbase = (num, base) => {
    if (num === 0n) return '0';
    const neg = num < 0n;
    let cur = neg ? -num : num;
    const b = BigInt(base);
    let out = '';
    while (cur > 0n) {
        out = DIGITS[Number(cur % b)] + out;
        cur /= b;
    }
    return neg ? `-${out}` : out;
};

const ipToLong = (ip) => {
    const parts = ip.trim().split('.');
    if (parts.length !== 4) return null;
    let num = 0;
    for (const p of parts) {
        if (!/^\d+$/.test(p)) return null;
        const octet = Number(p);
        if (octet < 0 || octet > 255) return null;
        num = (num * 256) + octet;
    }
    return num >>> 0;
};

const longToIp = (num) => {
    const n = Number(num) >>> 0;
    return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
};

const revdns = async (ip) => {
    try {
        const hosts = await dns.reverse(ip);
        return hosts && hosts.length ? hosts.join(', ') : null;
    }
    catch {
        return null;
    }
};

const unaryMathSub = (name, desc) => ({
    name: name,
    description: desc,
    type: ApplicationCommandOptionType.Subcommand,
    options: [
        {
            type: ApplicationCommandOptionType.Number,
            name: 'value',
            description: 'Input number.',
            required: true
        }
    ]
});

const binaryBitSub = (name, desc) => ({
    name: name,
    description: desc,
    type: ApplicationCommandOptionType.Subcommand,
    options: [
        {
            type: ApplicationCommandOptionType.Integer,
            name: 'a',
            description: 'First integer.',
            required: true
        },
        {
            type: ApplicationCommandOptionType.Integer,
            name: 'b',
            description: 'Second integer.',
            required: true
        }
    ]
});

const bitPosSub = (name, desc) => ({
    name: name,
    description: desc,
    type: ApplicationCommandOptionType.Subcommand,
    options: [
        {
            type: ApplicationCommandOptionType.Integer,
            name: 'value',
            description: 'Integer value.',
            required: true
        },
        {
            type: ApplicationCommandOptionType.Integer,
            name: 'bit',
            description: 'Bit position (1-64, 1 = least significant bit).',
            required: true,
            min_value: 1,
            max_value: 64
        }
    ]
});

module.exports = {
    config: {
        chat: {
            name: 'util',
            description: 'Math, string, time, and network utility commands.',
            options: [
                {
                    name: 'math',
                    description: 'Mathematical, trigonometric, bitwise, and base conversion utilities.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        {
                            name: 'calc',
                            description: 'Evaluate a mathematical expression.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.String,
                                    name: 'expression',
                                    description: 'Expression to evaluate.',
                                    required: true
                                }
                            ]
                        },
                        unaryMathSub('sqrt', 'Square root of a number.'),
                        unaryMathSub('sin', 'Sine of a number (radians).'),
                        unaryMathSub('cos', 'Cosine of a number (radians).'),
                        unaryMathSub('tan', 'Tangent of a number (radians).'),
                        unaryMathSub('asin', 'Arcsine of a number.'),
                        unaryMathSub('acos', 'Arccosine of a number.'),
                        unaryMathSub('atan', 'Arctangent of a number.'),
                        unaryMathSub('log', 'Natural logarithm of a number.'),
                        binaryBitSub('and', 'Bitwise AND of two integers.'),
                        binaryBitSub('or', 'Bitwise OR of two integers.'),
                        binaryBitSub('xor', 'Bitwise XOR of two integers.'),
                        bitPosSub('bit', 'Check whether the Nth bit is set.'),
                        bitPosSub('biton', 'Turn on the Nth bit of an integer.'),
                        bitPosSub('bitoff', 'Turn off the Nth bit of an integer.'),
                        {
                            name: 'convert',
                            description: 'Convert a number between bases (2-36).',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.Integer,
                                    name: 'inbase',
                                    description: 'Source base (2-36).',
                                    required: true,
                                    min_value: 2,
                                    max_value: 36
                                },
                                {
                                    type: ApplicationCommandOptionType.Integer,
                                    name: 'outbase',
                                    description: 'Target base (2-36).',
                                    required: true,
                                    min_value: 2,
                                    max_value: 36
                                },
                                {
                                    type: ApplicationCommandOptionType.String,
                                    name: 'value',
                                    description: 'Value to convert.',
                                    required: true
                                }
                            ]
                        }
                    ]
                },
                {
                    name: 'string',
                    description: 'Character code, hex encoding, length, and byte size utilities.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        {
                            name: 'asc',
                            description: 'Convert characters to character codes.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.String,
                                    name: 'text',
                                    description: 'Input text.',
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'chr',
                            description: 'Convert space-separated character codes to text.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.String,
                                    name: 'codes',
                                    description: 'Space-separated decimal character codes.',
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'encode',
                            description: 'Encode text into space-separated hex character codes.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.String,
                                    name: 'text',
                                    description: 'Input text.',
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'decode',
                            description: 'Decode space-separated hex character codes into text.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.String,
                                    name: 'hex',
                                    description: 'Space-separated hex character codes.',
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'len',
                            description: 'Return the length of a string.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.String,
                                    name: 'text',
                                    description: 'Input text.',
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'size',
                            description: 'Format a byte count with human-readable units.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.Number,
                                    name: 'bytes',
                                    description: 'Number of bytes.',
                                    required: true
                                }
                            ]
                        }
                    ]
                },
                {
                    name: 'time',
                    description: 'Unix timestamp, date formatting, and duration utilities.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        {
                            name: 'time',
                            description: 'Convert a date string to a Unix timestamp (or show current timestamp).',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.String,
                                    name: 'date',
                                    description: 'Date/time string to parse (omit for current time).',
                                    required: false
                                }
                            ]
                        },
                        {
                            name: 'asctime',
                            description: 'Format a Unix timestamp as a UTC date string (or show current UTC date).',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.Integer,
                                    name: 'timestamp',
                                    description: 'Unix timestamp in seconds (omit for current time).',
                                    required: false
                                }
                            ]
                        },
                        {
                            name: 'dur',
                            description: 'Format a duration in seconds as XwXdXhXmXs.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.Integer,
                                    name: 'seconds',
                                    description: 'Duration in seconds.',
                                    required: true
                                }
                            ]
                        }
                    ]
                },
                {
                    name: 'net',
                    description: 'DNS and IPv4 address conversion utilities.',
                    type: ApplicationCommandOptionType.SubcommandGroup,
                    options: [
                        {
                            name: 'dns',
                            description: 'Resolve a hostname or reverse-resolve an IP address.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.String,
                                    name: 'address',
                                    description: 'Hostname or IP address.',
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'longip',
                            description: 'Convert between dotted IPv4 and 32-bit integer.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.String,
                                    name: 'address',
                                    description: 'Dotted IPv4 address or 32-bit integer.',
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'hexip',
                            description: 'Convert a hex IPv4 value to dotted IPv4 and resolve DNS.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.String,
                                    name: 'hex',
                                    description: 'Hexadecimal IPv4 string.',
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'iphex',
                            description: 'Convert a dotted IPv4 address to hexadecimal.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.String,
                                    name: 'ip',
                                    description: 'Dotted IPv4 address.',
                                    required: true
                                }
                            ]
                        },
                        {
                            name: 'decrypt',
                            description: 'Decode a hex IPv4 address and reverse-resolve its hostname.',
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    type: ApplicationCommandOptionType.String,
                                    name: 'hex',
                                    description: 'Hexadecimal IPv4 string.',
                                    required: true
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    },
    async execute(bot, action) {
        const group = action.options.getSubcommandGroup();
        const sub = action.options.getSubcommand();
        const title = `🛠️ Util: ${group} ${sub}`;
        let out;

        switch (group) {
            case 'math': {
                switch (sub) {
                    case 'calc': {
                        const expr = action.options.getString('expression').trim();
                        if (expr.toLowerCase() === 'mc^2') {
                            out = '`mc^2` = **A BAJILLION**';
                        }
                        else {
                            const val = evalmath(expr);
                            out = `\`${expr}\` = **${val}**`;
                        }
                        break;
                    }
                    case 'sqrt':
                    case 'sin':
                    case 'cos':
                    case 'tan':
                    case 'asin':
                    case 'acos':
                    case 'atan':
                    case 'log': {
                        const val = action.options.getNumber('value');
                        const res = Math[sub](val);
                        out = `\`${sub}(${val})\` = **${res}**`;
                        break;
                    }
                    case 'and':
                    case 'or':
                    case 'xor': {
                        const a = BigInt(action.options.getInteger('a'));
                        const b = BigInt(action.options.getInteger('b'));
                        const res = sub === 'and' ? (a & b) : (sub === 'or' ? (a | b) : (a ^ b));
                        out = `\`${a} ${sub.toUpperCase()} ${b}\` = **${res}**`;
                        break;
                    }
                    case 'bit': {
                        const val = BigInt(action.options.getInteger('value'));
                        const bit = action.options.getInteger('bit');
                        const ison = (val & (1n << BigInt(bit - 1))) !== 0n;
                        out = `Bit ${bit} of \`${val}\`: **${ison ? 'Yes' : 'No'}**`;
                        break;
                    }
                    case 'biton': {
                        const val = BigInt(action.options.getInteger('value'));
                        const bit = action.options.getInteger('bit');
                        const res = val | (1n << BigInt(bit - 1));
                        out = `\`biton(${val}, ${bit})\` = **${res}**`;
                        break;
                    }
                    case 'bitoff': {
                        const val = BigInt(action.options.getInteger('value'));
                        const bit = action.options.getInteger('bit');
                        const res = val & ~(1n << BigInt(bit - 1));
                        out = `\`bitoff(${val}, ${bit})\` = **${res}**`;
                        break;
                    }
                    case 'convert': {
                        const inbase = action.options.getInteger('inbase');
                        const outbase = action.options.getInteger('outbase');
                        const raw = action.options.getString('value');
                        const num = parsebase(raw, inbase);
                        const conv = formatbase(num, outbase);
                        out = `\`${raw}\` (base ${inbase}) = **\`${conv}\`** (base ${outbase})`;
                        break;
                    }
                    default: throw `Invalid math subcommand '${sub}'.`;
                }
                break;
            }
            case 'string': {
                switch (sub) {
                    case 'asc': {
                        const text = action.options.getString('text');
                        const codes = [ ...text ].map(c => c.codePointAt(0)).join(' ');
                        out = `\`\`\`\n${codes}\n\`\`\``;
                        break;
                    }
                    case 'chr': {
                        const raw = action.options.getString('codes').trim();
                        const parts = raw.split(/\s+/);
                        const chars = parts.map(p => {
                            const n = Number(p);
                            if (!Number.isInteger(n) || n < 0 || n > 0x10FFFF) throw `Invalid character code '${escapeMarkdown(p)}'.`;
                            return String.fromCodePoint(n);
                        }).join('');
                        out = `\`\`\`\n${chars}\n\`\`\``;
                        break;
                    }
                    case 'encode': {
                        const text = action.options.getString('text');
                        const hex = [ ...text ].map(c => c.codePointAt(0).toString(16).toUpperCase()).join(' ');
                        out = `\`\`\`\n${hex}\n\`\`\``;
                        break;
                    }
                    case 'decode': {
                        const raw = action.options.getString('hex').trim();
                        const parts = raw.split(/\s+/);
                        const chars = parts.map(p => {
                            if (!/^[0-9a-fA-F]+$/.test(p)) throw `Invalid hex code '${escapeMarkdown(p)}'.`;
                            const n = parseInt(p, 16);
                            if (n < 0 || n > 0x10FFFF) throw `Invalid code point '${escapeMarkdown(p)}'.`;
                            return String.fromCodePoint(n);
                        }).join('');
                        out = `\`\`\`\n${chars}\n\`\`\``;
                        break;
                    }
                    case 'len': {
                        const text = action.options.getString('text');
                        out = `Length: **${text.length}**`;
                        break;
                    }
                    case 'size': {
                        const bytes = action.options.getNumber('bytes');
                        const units = [ 'B', 'KB', 'MB', 'GB', 'TB', 'PB' ];
                        let val = Math.abs(bytes), u = 0;
                        while (val >= 1024 && u < units.length - 1) {
                            val /= 1024;
                            u++;
                        }
                        const formatted = u === 0 ? `${bytes}B` : `${(bytes < 0 ? -val : val).toFixed(2).replace(/\.?0+$/, '')}${units[u]}`;
                        out = `\`${bytes}\` = **${formatted}**`;
                        break;
                    }
                    default: throw `Invalid string subcommand '${sub}'.`;
                }
                break;
            }
            case 'time': {
                switch (sub) {
                    case 'time': {
                        const raw = action.options.getString('date');
                        if (raw) {
                            const ms = Date.parse(raw);
                            if (Number.isNaN(ms)) throw `Could not parse date '${escapeMarkdown(raw)}'.`;
                            const secs = Math.floor(ms / 1000);
                            out = `\`${escapeMarkdown(raw)}\` = **${secs}** (<t:${secs}:F>)`;
                        }
                        else {
                            const secs = Math.floor(Date.now() / 1000);
                            out = `Current timestamp: **${secs}** (<t:${secs}:F>)`;
                        }
                        break;
                    }
                    case 'asctime': {
                        const ts = action.options.getInteger('timestamp');
                        const secs = ts !== null ? ts : Math.floor(Date.now() / 1000);
                        const str = new Date(secs * 1000).toUTCString();
                        out = `\`${secs}\` = **${str}** (<t:${secs}:F>)`;
                        break;
                    }
                    case 'dur': {
                        const secs = action.options.getInteger('seconds');
                        out = `\`${secs}s\` = **${global.tools.dur(secs)}**`;
                        break;
                    }
                    default: throw `Invalid time subcommand '${sub}'.`;
                }
                break;
            }
            case 'net': {
                await action.deferReply();
                switch (sub) {
                    case 'dns': {
                        const addr = action.options.getString('address').trim();
                        try {
                            if (net.isIP(addr)) {
                                const hosts = await dns.reverse(addr);
                                out = hosts.map(h => `\`${h}\` = \`${addr}\``).join('\n');
                            }
                            else {
                                const res = await dns.lookup(addr, { all: true });
                                out = res.map(r => `\`${escapeMarkdown(addr)}\` = \`${r.address}\``).join('\n');
                            }
                        }
                        catch {
                            out = 'Domain name resolution failed.';
                        }
                        break;
                    }
                    case 'longip': {
                        const raw = action.options.getString('address').trim();
                        if (raw.includes('.')) {
                            const num = ipToLong(raw);
                            if (num === null) throw `Invalid IPv4 address '${escapeMarkdown(raw)}'.`;
                            out = `\`${raw}\` = **${num}**`;
                        }
                        else if (/^\d+$/.test(raw)) {
                            const ip = longToIp(Number(raw));
                            const host = await revdns(ip);
                            out = `\`${raw}\` = **\`${ip}\`**` + (host ? `\n\`${ip}\` = \`${host}\`` : '');
                        }
                        else {
                            throw `Invalid IPv4 address or integer '${escapeMarkdown(raw)}'.`;
                        }
                        break;
                    }
                    case 'hexip': {
                        const raw = action.options.getString('hex').trim().replace(/^0x/i, '');
                        if (!/^[0-9a-fA-F]{1,8}$/.test(raw)) throw `Invalid hex IPv4 '${escapeMarkdown(raw)}'.`;
                        const ip = longToIp(parseInt(raw, 16));
                        const host = await revdns(ip);
                        out = `\`${raw}\` = **\`${ip}\`**` + (host ? `\n\`${ip}\` = \`${host}\`` : '');
                        break;
                    }
                    case 'iphex': {
                        const raw = action.options.getString('ip').trim();
                        const num = raw.includes('.') ? ipToLong(raw) : (/^\d+$/.test(raw) ? (Number(raw) >>> 0) : null);
                        if (num === null) throw `Invalid IPv4 address '${escapeMarkdown(raw)}'.`;
                        out = `\`${raw}\` = **\`${num.toString(16).toLowerCase()}\`**`;
                        break;
                    }
                    case 'decrypt': {
                        const raw = action.options.getString('hex').trim().replace(/^0x/i, '');
                        if (!/^[0-9a-fA-F]{1,8}$/.test(raw)) throw `Invalid hex IPv4 '${escapeMarkdown(raw)}'.`;
                        const ip = longToIp(parseInt(raw, 16));
                        const host = await revdns(ip);
                        out = host ? `\`${host}\` = \`${ip}\`` : `\`${ip}\` (domain name resolution failed)`;
                        break;
                    }
                    default: throw `Invalid net subcommand '${sub}'.`;
                }
                await action.editReply({
                    embeds: [{
                        color: 0x8888ff,
                        title: title,
                        description: out
                    }]
                });
                return;
            }
            default: throw `Invalid subcommand group '${group}'.`;
        }

        await action.reply({
            embeds: [{
                color: 0x8888ff,
                title: title,
                description: out
            }]
        });
    },
};
