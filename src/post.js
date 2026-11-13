const { RESTJSONErrorCodes } = require('discord.js');

// The bot's own posts to its channels, log entries and notices, each channel taking them in turn under Discord's
// 5 posts every 5 seconds: notices waiting together are merged and never lost, identical log entries waiting
// together are counted, and log entries past the backlog are dropped, oldest first
// What Discord allows, which no setting changes: characters in a post, and in an embed's description
const DISCORD_POSTSIZE = 2000;
const DISCORD_EMBEDSIZE = 4096;

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
    // A notice for the general channel: { title, color, text, thumbnail, react }, react being an emoji id
    notice(notice) {
        const line = this.line(this.bot && this.bot.config.channels.general);
        if (!line) return;
        line.items.push({ kind: 'notice', ...notice });
        this.pump(line);
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
                const sent = await chan.send({ content: item.content, embeds: item.embeds });
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
