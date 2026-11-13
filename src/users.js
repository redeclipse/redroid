const fs = require('fs');
const { escapeMarkdown } = require('discord.js');

const GENERIC_NAMES = new Set([
    'anon', 'anonymous', 'random', 'name', 'news', 'heaven',
    'dolphin', 'trooper', 'vade', 'hero', 'rave', 'twin'
]);

module.exports = {
    name: 'users',
    users: {},
    file: null, // config.users.file
    start(bot) {
        this.file = (bot.config.users || {}).file;
        if (!this.file) throw new Error('Users: config.users.file is needed.');
        global.log.out(`Loading users: ${this.file}`);
        try {
            const parsed = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
            this.users = {};
            for (const [ key, val ] of Object.entries(parsed)) {
                this.users[key] = {
                    ids: Array.isArray(val.ids) ? val.ids.map(String) : [],
                    aliases: Array.isArray(val.aliases) ? val.aliases.map(String) : []
                };
            }
            global.log.out('Users loaded ' + Object.keys(this.users).length + ' entries.');
        }
        catch (e) {
            global.log.error(e);
        }
        return true;
    },
    shutdown() {
        // this.save();
    },
    save() {
        global.log.out(`Saving users: ${this.file}`);
        return global.tools.writejson(this.file, this.users);
    },
    norm(str) {
        if (!str) return '';
        return str.toLowerCase()
            .replace(/^[_.\-[\]{}`]+|[_.\-[\]{}`0-9]+$/g, '')
            .replace(/[_\-.]/g, '');
    },
    isgeneric(normstr) {
        return !normstr || normstr.length < 4 || GENERIC_NAMES.has(normstr);
    },
    findkey(target, allowNorm = false) {
        if (!target) return null;
        if (Object.hasOwn(this.users, target)) return target;
        const lower = target.toLowerCase();
        for (const key of Object.keys(this.users)) {
            if (key.toLowerCase() === lower) return key;
        }
        for (const [ key, entry ] of Object.entries(this.users)) {
            if (entry.aliases.some(a => a.toLowerCase() === lower)) return key;
        }
        if (allowNorm) {
            const n = this.norm(target);
            if (!this.isgeneric(n)) {
                for (const [ key, entry ] of Object.entries(this.users)) {
                    if (this.norm(key) === n || entry.aliases.some(a => this.norm(a) === n)) return key;
                }
            }
        }
        return null;
    },
    byid(id) {
        if (!id) return null;
        const sid = String(id);
        for (const [ key, entry ] of Object.entries(this.users)) {
            if (entry.ids.includes(sid)) return key;
        }
        return null;
    },
    findstorekey(store, target, allowNorm = false) {
        if (!store || !target) return null;
        if (Object.hasOwn(store, target)) return target;
        const lower = target.toLowerCase();
        for (const key of Object.keys(store)) {
            if (key.toLowerCase() === lower) return key;
        }
        if (allowNorm) {
            const n = this.norm(target);
            if (!this.isgeneric(n)) {
                for (const key of Object.keys(store)) {
                    if (this.norm(key) === n) return key;
                }
            }
        }
        return null;
    },
    bymember(member) {
        if (!member) return null;
        const user = member.user || member;
        const byId = this.byid(user.id);
        if (byId) return byId;

        const cands = [ member.displayName, user.globalName, user.username ].filter(Boolean);
        for (const cand of cands) {
            const ukey = this.findkey(cand, false);
            if (ukey) return ukey;
            const qkey = global.quote && this.findstorekey(global.quote.quotes, cand, false);
            if (qkey && !this.isgeneric(this.norm(qkey))) return qkey;
            const tkey = global.stats && this.findstorekey(global.stats.data.tipjar, cand, false);
            if (tkey) return tkey;
            const fkey = global.faq && this.findstorekey(global.faq.faqs, cand, false);
            if (fkey && !this.isgeneric(this.norm(fkey))) return fkey;
        }
        for (const cand of cands) {
            const ukey = this.findkey(cand, true);
            if (ukey) return ukey;
            const qkey = global.quote && this.findstorekey(global.quote.quotes, cand, true);
            if (qkey) return qkey;
            const tkey = global.stats && this.findstorekey(global.stats.data.tipjar, cand, true);
            if (tkey) return tkey;
        }
        return null;
    },
    findmember(guild, name) {
        if (!name) return null;
        const ukey = this.findkey(name, true);
        if (ukey && this.users[ukey].ids.length > 0) {
            for (const id of this.users[ukey].ids) {
                const cached = guild ? guild.members.cache.get(id) : null;
                if (cached) return { id, member: cached, key: ukey };
            }
            return { id: this.users[ukey].ids[0], member: null, key: ukey };
        }
        if (!guild) return null;

        const names = ukey ? [ ukey, ...this.users[ukey].aliases ] : [ name ];
        const lowers = new Set(names.map(n => n.toLowerCase()));
        for (const n of lowers) {
            if (GENERIC_NAMES.has(n)) return null;
        }

        const exact = guild.members.cache.find(m => {
            const mapped = this.byid(m.user.id);
            if (mapped && ukey && mapped !== ukey) return false;
            const d = m.displayName ? m.displayName.toLowerCase() : '';
            const g = m.user.globalName ? m.user.globalName.toLowerCase() : '';
            const u = m.user.username ? m.user.username.toLowerCase() : '';
            return lowers.has(d) || lowers.has(g) || lowers.has(u);
        });
        if (exact) {
            return { id: exact.user.id, member: exact, key: ukey || this.byid(exact.user.id) || name };
        }

        const norms = new Set(names.map(n => this.norm(n)).filter(n => !this.isgeneric(n)));
        if (norms.size > 0) {
            const fuzzy = guild.members.cache.find(m => {
                const mapped = this.byid(m.user.id);
                if (mapped && ukey && mapped !== ukey) return false;
                const d = this.norm(m.displayName);
                const g = this.norm(m.user.globalName);
                const u = this.norm(m.user.username);
                return norms.has(d) || norms.has(g) || norms.has(u);
            });
            if (fuzzy) {
                return { id: fuzzy.user.id, member: fuzzy, key: ukey || this.byid(fuzzy.user.id) || name };
            }
        }
        return null;
    },
    display(name, guild = null) {
        if (!name) return '';
        const found = this.findmember(guild, name);
        if (found && found.id) return `<@${found.id}>`;
        const ukey = this.findkey(name, false);
        return escapeMarkdown(ukey || name);
    },
    async resolve(action, raw) {
        if (!raw) return null;
        const trimmed = raw.trim();
        const guild = action ? action.guild : null;
        const member = await global.tools.resolvemember(action, trimmed);
        const idMatch = trimmed.match(/^(?:<@!?(\d+)>|(\d{17,20}))$/);
        const rawId = member ? member.user.id : (idMatch ? (idMatch[1] || idMatch[2]) : null);
        if (rawId) {
            const name = (member && this.bymember(member))
                || this.byid(rawId)
                || (member ? (member.user.globalName || member.displayName || member.user.username) : rawId);
            return { name, id: rawId, member, display: `<@${rawId}>` };
        }

        const ukey = this.findkey(trimmed, false);
        if (ukey) {
            const found = this.findmember(guild, ukey);
            return {
                name: ukey,
                id: found ? found.id : null,
                member: found ? found.member : null,
                display: found && found.id ? `<@${found.id}>` : escapeMarkdown(ukey)
            };
        }

        const found = this.findmember(guild, trimmed);
        if (found) {
            const name = (found.member && this.bymember(found.member)) || this.byid(found.id) || found.key || trimmed;
            return {
                name,
                id: found.id,
                member: found.member,
                display: `<@${found.id}>`
            };
        }

        const nkey = this.findkey(trimmed, true);
        if (nkey) {
            const foundNorm = this.findmember(guild, nkey);
            return {
                name: nkey,
                id: foundNorm ? foundNorm.id : null,
                member: foundNorm ? foundNorm.member : null,
                display: foundNorm && foundNorm.id ? `<@${foundNorm.id}>` : escapeMarkdown(nkey)
            };
        }

        const storeKey = (global.quote && this.findstorekey(global.quote.quotes, trimmed, true))
            || (global.stats && this.findstorekey(global.stats.data.tipjar, trimmed, true))
            || (global.faq && this.findstorekey(global.faq.faqs, trimmed, false));
        if (storeKey) {
            const foundStore = this.findmember(guild, storeKey);
            return {
                name: storeKey,
                id: foundStore ? foundStore.id : null,
                member: foundStore ? foundStore.member : null,
                display: foundStore && foundStore.id ? `<@${foundStore.id}>` : escapeMarkdown(storeKey)
            };
        }

        return { name: trimmed, id: null, member: null, display: escapeMarkdown(trimmed) };
    },
    canonicalize(name) {
        const ukey = this.findkey(name, false);
        if (ukey) return ukey;
        const qkey = global.quote && this.findstorekey(global.quote.quotes, name, false);
        if (qkey) return qkey;
        const tkey = global.stats && this.findstorekey(global.stats.data.tipjar, name, false);
        if (tkey) return tkey;
        const fkey = global.faq && this.findstorekey(global.faq.faqs, name, false);
        if (fkey) return fkey;
        return name;
    },
    ensure(name) {
        const key = this.canonicalize(name);
        if (!Object.hasOwn(this.users, key)) {
            this.users[key] = { ids: [], aliases: [] };
        }
        return { key, entry: this.users[key] };
    },
    mergestores(from, to) {
        const merged = { quotes: 0, tipjar: 0, faqs: 0 };
        if (from === to) return merged;
        if (global.quote && global.quote.quotes) {
            const qfrom = this.findstorekey(global.quote.quotes, from, false);
            if (qfrom && qfrom !== to) {
                if (!global.quote.quotes[to]) global.quote.quotes[to] = [];
                for (const item of global.quote.quotes[qfrom]) {
                    if (!global.quote.quotes[to].some(x => x.body === item.body && x.type === item.type)) {
                        global.quote.quotes[to].push(item);
                        merged.quotes++;
                    }
                }
                delete global.quote.quotes[qfrom];
                global.quote.save();
            }
        }
        if (global.stats && global.stats.data && global.stats.data.tipjar) {
            const tfrom = this.findstorekey(global.stats.data.tipjar, from, false);
            if (tfrom && tfrom !== to) {
                const amount = global.stats.data.tipjar[tfrom];
                global.stats.data.tipjar[to] = (global.stats.data.tipjar[to] || 0) + amount;
                delete global.stats.data.tipjar[tfrom];
                merged.tipjar = amount;
                global.stats.save();
            }
        }
        if (global.faq && global.faq.faqs) {
            const ffrom = this.findstorekey(global.faq.faqs, from, false);
            if (ffrom && ffrom !== to) {
                if (!global.faq.faqs[to]) global.faq.faqs[to] = [];
                for (const item of global.faq.faqs[ffrom]) {
                    if (!global.faq.faqs[to].includes(item)) {
                        global.faq.faqs[to].push(item);
                        merged.faqs++;
                    }
                }
                delete global.faq.faqs[ffrom];
                global.faq.save();
            }
        }
        return merged;
    },
    link(name, userid, unlink = false) {
        const sid = String(userid);
        if (unlink) {
            const key = this.findkey(name, false) || this.byid(sid);
            if (!key || !this.users[key]) throw `User entry '${escapeMarkdown(name)}' was not found.`;
            const idx = this.users[key].ids.indexOf(sid);
            if (idx < 0) throw `<@${sid}> is not linked to '${escapeMarkdown(key)}'.`;
            this.users[key].ids.splice(idx, 1);
            if (!this.save()) throw 'The change was made but could not be saved to disk, it will be lost on restart.';
            return { key, entry: this.users[key] };
        }
        for (const entry of Object.values(this.users)) {
            const idx = entry.ids.indexOf(sid);
            if (idx >= 0) entry.ids.splice(idx, 1);
        }
        const { key, entry } = this.ensure(name);
        if (!entry.ids.includes(sid)) entry.ids.push(sid);
        if (!this.save()) throw 'The change was made but could not be saved to disk, it will be lost on restart.';
        return { key, entry };
    },
    alias(name, aliasname, remove = false) {
        const clean = aliasname.trim();
        if (!clean) throw 'Alias name cannot be empty.';
        if (remove) {
            const key = this.findkey(name, false);
            if (!key || !this.users[key]) throw `User entry '${escapeMarkdown(name)}' was not found.`;
            const lower = clean.toLowerCase();
            const idx = this.users[key].aliases.findIndex(a => a.toLowerCase() === lower);
            if (idx < 0) throw `'${escapeMarkdown(clean)}' is not an alias of '${escapeMarkdown(key)}'.`;
            const removed = this.users[key].aliases.splice(idx, 1)[0];
            if (!this.save()) throw 'The change was made but could not be saved to disk, it will be lost on restart.';
            return { key, alias: removed, entry: this.users[key], merged: null };
        }

        const { key, entry } = this.ensure(name);
        const lower = clean.toLowerCase();
        for (const [ okey, oentry ] of Object.entries(this.users)) {
            if (okey !== key) {
                const idx = oentry.aliases.findIndex(a => a.toLowerCase() === lower);
                if (idx >= 0) oentry.aliases.splice(idx, 1);
            }
        }
        const otherKey = Object.keys(this.users).find(k => k !== key && k.toLowerCase() === lower);
        if (otherKey) {
            for (const id of this.users[otherKey].ids) {
                if (!entry.ids.includes(id)) entry.ids.push(id);
            }
            for (const al of this.users[otherKey].aliases) {
                if (al.toLowerCase() !== key.toLowerCase() && !entry.aliases.some(a => a.toLowerCase() === al.toLowerCase())) {
                    entry.aliases.push(al);
                }
            }
            delete this.users[otherKey];
        }
        if (lower !== key.toLowerCase() && !entry.aliases.some(a => a.toLowerCase() === lower)) {
            entry.aliases.push(clean);
        }
        const merged = this.mergestores(clean, key);
        if (!this.save()) throw 'The change was made but could not be saved to disk, it will be lost on restart.';
        return { key, alias: clean, entry, merged };
    },
    rename(oldname, newname) {
        const cleanNew = newname.trim();
        if (!cleanNew) throw 'New name cannot be empty.';
        const oldkey = this.canonicalize(oldname.trim());
        const hasUser = Object.hasOwn(this.users, oldkey);
        const hasQuote = global.quote && Object.hasOwn(global.quote.quotes, oldkey);
        const hasTip = global.stats && Object.hasOwn(global.stats.data.tipjar, oldkey);
        const hasFaq = global.faq && Object.hasOwn(global.faq.faqs, oldkey);
        if (!hasUser && !hasQuote && !hasTip && !hasFaq) {
            throw `User '${escapeMarkdown(oldname)}' was not found in users, quotes, tipjar, or FAQs.`;
        }

        if (!Object.hasOwn(this.users, cleanNew)) {
            this.users[cleanNew] = { ids: [], aliases: [] };
        }
        const dest = this.users[cleanNew];
        if (hasUser && oldkey !== cleanNew) {
            const src = this.users[oldkey];
            for (const id of src.ids) {
                if (!dest.ids.includes(id)) dest.ids.push(id);
            }
            for (const al of src.aliases) {
                if (al.toLowerCase() !== cleanNew.toLowerCase() && !dest.aliases.some(a => a.toLowerCase() === al.toLowerCase())) {
                    dest.aliases.push(al);
                }
            }
            delete this.users[oldkey];
        }
        dest.aliases = dest.aliases.filter(a => a.toLowerCase() !== cleanNew.toLowerCase());
        if (oldkey.toLowerCase() !== cleanNew.toLowerCase() && !dest.aliases.some(a => a.toLowerCase() === oldkey.toLowerCase())) {
            dest.aliases.push(oldkey);
        }

        const merged = this.mergestores(oldkey, cleanNew);
        if (!this.save()) throw 'The change was made but could not be saved to disk, it will be lost on restart.';
        return { oldkey, newkey: cleanNew, entry: dest, merged };
    }
};
