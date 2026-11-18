const { RESTJSONErrorCodes } = require('discord.js');

// The bot's own posts to its channels, log entries, audit embeds, notices, admin notices and find players lines, each channel taking them in turn under Discord's
// 5 posts every 5 seconds: notices waiting together are merged and never lost, audit and admin notice embeds waiting together are packed up to
// 10 per post, identical log entries waiting together are counted, and log or audit entries past the backlog are dropped, oldest first
// What Discord allows, which no setting changes: characters in a post, in an embed's description, embeds per post, and total embed characters per post
const DISCORD_POSTSIZE = 2000;
const DISCORD_EMBEDSIZE = 4096;
const DISCORD_EMBEDS = 10;
const DISCORD_EMBEDTOTAL = 6000;

module.exports = {
    name: 'post',
    config: null, // config.post
    bot: null,
    stopped: false,
    lines: new Map(), // channel id -> { items, sent, pumping, paused, dropped }

    // Not registered for shutdown, as the bot's shutdown lets the backlog out first with finish()
    start(bot) {
        this.bot = bot;
        this.config = bot.config.post;
        if (!this.config) throw new Error('Post: config.post is needed.');
        return false;
    },

    // A log entry for the log channel; type is LOG, WARN or ERROR
    log(type, text) {
        const line = this.line(this.bot && this.bot.config.channels.log);
        if (!line) return;
        const last = line.items[line.items.length - 1];
        if (last && last.kind === 'log' && last.type === type && last.text === text) {
            last.count++;
            return;
        }
        line.items.push({ kind: 'log', type, text, count: 1 });
        const logs = line.items.filter(o => o.kind === 'log');
        if (logs.length > this.config.backlog) {
            line.items.splice(line.items.indexOf(logs[0]), 1);
            line.dropped += logs[0].count;
        }
        this.pump(line);
    },
    // A notice for the general channel: { title, color, text, thumbnail, icon, react }, its text starting with the icon emoji named
    // in icon, and react the icon emoji it's reacted with
    notice(notice) {
        const line = this.line(this.bot && this.bot.config.channels.general);
        if (!line) return;
        const text = `${notice.icon && global.emoji ? global.emoji.icons(notice.icon) : ''}${notice.text}`;
        line.items.push({ kind: 'notice', ...notice, text });
        this.pump(line);
    },
    // A line for the find players channel, about the Matchmaking Queue or someone joining or leaving a server; lines waiting
    // together go in one post, they never mention anyone, and past the backlog the oldest are dropped
    findplayers(text) {
        const line = this.line(this.bot && this.bot.config.channels.findplayers);
        if (!line) return;
        line.items.push({ kind: 'find', text });
        const finds = line.items.filter(o => o.kind === 'find');
        if (finds.length > this.config.backlog) {
            line.items.splice(line.items.indexOf(finds[0]), 1);
            line.dropped++;
        }
        this.pump(line);
    },
    // An embed for the admin notices channel, from the master's Admin notices; embeds waiting together are packed into one post as
    // audit embeds are, they never mention anyone, and none are dropped, as each is something an administrator has to see
    adminnotice(embed) {
        const line = this.line(this.bot && this.bot.config.channels.notices);
        if (!line) return false;
        line.items.push({ kind: 'admin', embed });
        this.pump(line);
        return true;
    },
    // An audit embed for the audit channel
    audit(embed) {
        const line = this.line(this.bot && this.bot.config.channels.audit);
        if (!line) return;
        line.items.push({ kind: 'audit', embed });
        const audits = line.items.filter(o => o.kind === 'audit');
        if (audits.length > this.config.backlog) {
            line.items.splice(line.items.indexOf(audits[0]), 1);
            line.dropped++;
        }
        this.pump(line);
    },
    // The head's embed with those of its kind waiting right after it, as many as one post holds
    pack(line, head) {
        const embeds = [head.embed];
        let total = this.embedsize(head.embed);
        while (line.items.length && embeds.length < DISCORD_EMBEDS) {
            const next = line.items[0];
            if (next.kind !== head.kind) break;
            const nextsize = this.embedsize(next.embed);
            if (total + nextsize > DISCORD_EMBEDTOTAL) break;
            embeds.push(next.embed);
            total += nextsize;
            line.items.shift();
        }
        return embeds;
    },
    embedsize(embed) {
        let len = (embed.title ? embed.title.length : 0)
            + (embed.description ? embed.description.length : 0)
            + (embed.author && embed.author.name ? embed.author.name.length : 0)
            + (embed.footer && embed.footer.text ? embed.footer.text.length : 0);
        if (Array.isArray(embed.fields)) {
            for (const f of embed.fields) len += (f.name ? f.name.length : 0) + (f.value ? f.value.length : 0);
        }
        return len;
    },

    line(id) {
        if (!id || this.stopped || !this.bot || this.bot.online !== true) return null;
        let line = this.lines.get(id);
        if (!line) {
            line = { id, items: [], sent: [], pumping: false, paused: 0, dropped: 0 };
            this.lines.set(id, line);
        }
        return line.paused > Date.now() ? null : line;
    },
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    async pump(line) {
        if (line.pumping) return;
        line.pumping = true;
        while (line.items.length && !this.stopped) {
            const now = Date.now();
            line.sent = line.sent.filter(t => now - t < this.config.window);
            if (line.sent.length >= this.config.burst) {
                await this.wait(line.sent[0] + this.config.window - now);
                continue;
            }
            const chan = this.bot.online === true ? this.bot.channels.cache.get(line.id) : null;
            if (!chan) {
                line.items = [];
                break;
            }
            const item = this.take(line);
            line.sent.push(Date.now());
            try {
                const sent = await chan.send({ content: item.content, embeds: item.embeds, allowedMentions: item.allowedMentions });
                if (item.react) await global.tools.react(sent, item.react).catch(err => global.log.out(`Post: couldn't react in ${chan.name}: ${err.message}`));
            }
            catch (err) {
                // Console only from here, as the log channel may be the one refusing
                if (err && (err.code === RESTJSONErrorCodes.MissingAccess || err.code === RESTJSONErrorCodes.MissingPermissions)) {
                    global.log.out(`Post: ${chan.name} refused the bot (${err.message}), dropping ${line.items.length} waiting and leaving it alone for ${this.config.pause / 60000} minutes.`);
                    line.items = [];
                    line.dropped = 0;
                    line.paused = Date.now() + this.config.pause;
                }
                else {
                    global.log.out(`Post: couldn't post in ${chan.name}: ${err.stack || err}`);
                }
            }
        }
        line.pumping = false;
    },
    // The next post: a log entry, or a notice with the ones of its kind waiting right after it joined on
    take(line) {
        const head = line.items.shift();
        if (head.kind === 'log') {
            let text = `[${head.type}${head.count > 1 ? ` ×${head.count}` : ''}] ${head.text}`;
            if (line.dropped) {
                text = `*${line.dropped} log ${line.dropped === 1 ? 'entry was' : 'entries were'} dropped to keep up, see the console.*\n${text}`;
                line.dropped = 0;
            }
            if (text.length > DISCORD_POSTSIZE) text = text.slice(0, DISCORD_POSTSIZE - 20) + '\n... (truncated)';
            return { content: text };
        }
        if (head.kind === 'audit') {
            const embeds = this.pack(line, head);
            let content;
            if (line.dropped) {
                content = `*${line.dropped} audit ${line.dropped === 1 ? 'entry was' : 'entries were'} dropped to keep up.*`;
                line.dropped = 0;
            }
            return { content, embeds };
        }
        if (head.kind === 'admin') return { embeds: this.pack(line, head), allowedMentions: { parse: [] } };
        if (head.kind === 'find') {
            const texts = [];
            if (line.dropped) {
                texts.push(`*${line.dropped} ${line.dropped === 1 ? 'line was' : 'lines were'} dropped to keep up.*`);
                line.dropped = 0;
            }
            texts.push(head.text.slice(0, DISCORD_POSTSIZE));
            let size = texts.join('\n').length;
            while (line.items.length && line.items[0].kind === 'find' && size + 1 + line.items[0].text.length <= DISCORD_POSTSIZE) {
                const o = line.items.shift();
                texts.push(o.text);
                size += 1 + o.text.length;
            }
            return { content: texts.join('\n'), allowedMentions: { parse: [] } };
        }
        const texts = [head.text];
        let size = head.text.length;
        while (line.items.length) {
            const o = line.items[0];
            if (o.kind !== 'notice' || o.title !== head.title || o.color !== head.color) break;
            if (size + 1 + o.text.length > DISCORD_EMBEDSIZE) break; // the rest go in the next post
            texts.push(o.text);
            size += 1 + o.text.length;
            line.items.shift();
        }
        const embed = { color: head.color, title: texts.length > 1 ? `${head.title} (${texts.length})` : head.title, description: texts.join('\n') };
        if (texts.length === 1 && head.thumbnail) embed.thumbnail = { url: head.thumbnail };
        return { embeds: [embed], react: head.react };
    },
    // Lets every channel's backlog go out for up to ms, then drops what's left
    async finish(ms) {
        const until = Date.now() + ms;
        while (Date.now() < until && [...this.lines.values()].some(l => l.pumping)) await this.wait(100);
        this.stopped = true;
        this.lines.clear();
    }
};
