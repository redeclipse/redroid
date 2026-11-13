const fs = require('fs');
const { AuditLogEvent, ChannelType, Events, OverwriteType, PermissionsBitField, escapeMarkdown } = require('discord.js');

const DISCORD_EMBEDSIZE = 4096;
const DISCORD_FIELDVALUE = 1024;

const CATEGORIES = [
    'messages',
    'members',
    'moderation',
    'channels',
    'roles',
    'threads',
    'expressions',
    'invites'
];

const CHANNEL_TYPES = {
    [ChannelType.GuildText]: 'Text Channel',
    [ChannelType.GuildVoice]: 'Voice Channel',
    [ChannelType.GuildCategory]: 'Category',
    [ChannelType.GuildAnnouncement]: 'Announcement Channel',
    [ChannelType.AnnouncementThread]: 'Announcement Thread',
    [ChannelType.PublicThread]: 'Public Thread',
    [ChannelType.PrivateThread]: 'Private Thread',
    [ChannelType.GuildStageVoice]: 'Stage Channel',
    [ChannelType.GuildForum]: 'Forum Channel',
    [ChannelType.GuildMedia]: 'Media Channel'
};

module.exports = {
    name: 'audit',
    categories: CATEGORIES,
    config: null, // config.audit
    bot: null,
    stopped: false,
    savetimer: null,
    timers: new Set(),
    ignored: new Set(),
    disabled: new Set(),
    cache: new Map(), // message id -> { id, channelId, authorId, tag, avatar, content, attachments, stickers, createdTimestamp }

    start(bot) {
        this.bot = bot;
        this.config = bot.config.audit;
        if (!this.config || !this.config.file) throw new Error('Audit: config.audit is needed.');
        this.stopped = false;
        this.ignored = new Set((this.config.ignore || []).map(String));
        this.disabled = new Set();
        this.cache = new Map();

        if (fs.existsSync(this.config.file)) {
            global.log.out(`Loading audit: ${this.config.file}`);
            try {
                const parsed = JSON.parse(fs.readFileSync(this.config.file, 'utf-8'));
                if (Array.isArray(parsed.ignored)) {
                    for (const id of parsed.ignored) this.ignored.add(String(id));
                }
                if (Array.isArray(parsed.disabled)) {
                    for (const cat of parsed.disabled) {
                        if (CATEGORIES.includes(cat)) this.disabled.add(cat);
                    }
                }
                if (Array.isArray(parsed.messages)) {
                    const slice = parsed.messages.slice(-this.config.cache);
                    for (const m of slice) {
                        if (m && m.id) this.cache.set(String(m.id), m);
                    }
                }
                global.log.out(`Audit loaded ${this.cache.size} cached messages, ${this.ignored.size} ignored channels, ${this.disabled.size} disabled categories.`);
            }
            catch (e) {
                global.log.error(e);
            }
        }

        bot.on(Events.MessageCreate, m => this.messagecreate(m).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.MessageUpdate, (o, n) => this.messageupdate(o, n).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.MessageDelete, m => this.messagedelete(m).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.MessageBulkDelete, (ms, c) => this.messagebulkdelete(ms, c).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.UserUpdate, (o, n) => this.userupdate(o, n).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.ChannelCreate, c => this.channelcreate(c).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.ChannelDelete, c => this.channeldelete(c).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.ChannelUpdate, (o, n) => this.channelupdate(o, n).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.GuildRoleCreate, r => this.rolecreate(r).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.GuildRoleDelete, r => this.roledelete(r).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.GuildRoleUpdate, (o, n) => this.roleupdate(o, n).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.ThreadCreate, (t, nw) => this.threadcreate(t, nw).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.ThreadDelete, t => this.threaddelete(t).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.ThreadUpdate, (o, n) => this.threadupdate(o, n).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.GuildEmojiCreate, e => this.emojicreate(e).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.GuildEmojiDelete, e => this.emojidelete(e).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.GuildEmojiUpdate, (o, n) => this.emojiupdate(o, n).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.GuildStickerCreate, s => this.stickercreate(s).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.GuildStickerDelete, s => this.stickerdelete(s).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.GuildStickerUpdate, (o, n) => this.stickerupdate(o, n).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.InviteCreate, i => this.invitecreate(i).catch(err => global.log.error(`Audit: ${err.stack || err}`)));
        bot.on(Events.InviteDelete, i => this.invitedelete(i).catch(err => global.log.error(`Audit: ${err.stack || err}`)));

        return true;
    },
    shutdown() {
        this.stopped = true;
        if (this.savetimer) {
            clearTimeout(this.savetimer);
            this.savetimer = null;
        }
        for (const timer of this.timers) clearTimeout(timer);
        this.timers.clear();
        this.save();
    },
    save() {
        if (this.savetimer) {
            clearTimeout(this.savetimer);
            this.savetimer = null;
        }
        const payload = {
            ignored: [...this.ignored],
            disabled: [...this.disabled],
            messages: [...this.cache.values()].slice(-this.config.cache)
        };
        return global.tools.writejson(this.config.file, payload);
    },
    touch() {
        if (this.savetimer || this.stopped) return;
        this.savetimer = setTimeout(() => {
            this.savetimer = null;
            if (!this.stopped) this.save();
        }, this.config.savegap);
    },
    wait(ms) {
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                this.timers.delete(timer);
                resolve();
            }, ms);
            this.timers.add(timer);
        });
    },

    // Runtime configuration helpers for /audit
    toggleignore(channelId) {
        const id = String(channelId);
        const added = !this.ignored.has(id);
        if (added) this.ignored.add(id);
        else this.ignored.delete(id);
        if (!this.save()) throw 'The change was made but could not be saved to disk, it will be lost on restart.';
        return added;
    },
    togglecategory(category) {
        const cat = String(category).toLowerCase();
        if (!CATEGORIES.includes(cat)) throw `Unknown audit category '${escapeMarkdown(category)}'.`;
        const enabled = this.disabled.has(cat);
        if (enabled) this.disabled.delete(cat);
        else this.disabled.add(cat);
        if (!this.save()) throw 'The change was made but could not be saved to disk, it will be lost on restart.';
        return enabled;
    },

    enabled(category) {
        return Boolean(
            this.bot
            && this.bot.online === true
            && !this.stopped
            && this.bot.config.channels
            && this.bot.config.channels.audit
            && !this.disabled.has(category)
        );
    },
    isignored(channel) {
        if (!channel) return true;
        const chans = (this.bot && this.bot.config.channels) || {};
        const id = String(channel.id || channel);
        if (id === chans.audit || id === chans.log || this.ignored.has(id)) return true;
        if (channel.parentId && this.ignored.has(String(channel.parentId))) return true;
        if (channel.parent && channel.parent.parentId && this.ignored.has(String(channel.parent.parentId))) return true;
        return false;
    },
    trunc(str, max = DISCORD_FIELDVALUE) {
        if (!str) return '*Empty*';
        const text = String(str);
        if (text.length <= max) return text;
        return text.slice(0, max - 15) + '\n... (truncated)';
    },
    userauthor(user) {
        if (!user) return { name: 'Unknown User' };
        return {
            name: user.tag || user.username || String(user.id),
            icon_url: typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL() : (user.avatar || undefined)
        };
    },
    guildauthor(guild) {
        if (!guild) return { name: 'Server' };
        return {
            name: guild.name,
            icon_url: typeof guild.iconURL === 'function' ? (guild.iconURL() || undefined) : undefined
        };
    },
    send(embed) {
        if (!global.post) return;
        global.post.audit(Object.assign({ timestamp: new Date().toISOString() }, embed));
    },

    // Queries Discord's Audit Log after a brief delay so the entry has landed
    async fetchlog(guild, type, targetId = null, check = null) {
        if (!guild || !this.config) return null;
        if (this.config.delay > 0) await this.wait(this.config.delay);
        if (this.stopped) return null;
        try {
            const logs = await guild.fetchAuditLogs({ limit: 5, type });
            const now = Date.now();
            for (const entry of logs.entries.values()) {
                if (now - entry.createdTimestamp > this.config.window) continue;
                if (targetId && String(entry.targetId) !== String(targetId)) continue;
                if (check && !check(entry)) continue;
                return entry;
            }
        }
        catch {
            // Missing ViewAuditLog permission or transient failure
        }
        return null;
    },
    formatmod(entry, includeReason = true) {
        if (!entry || !entry.executorId) return null;
        let out = `<@${entry.executorId}>`;
        if (entry.executor && entry.executor.tag) out += ` (${escapeMarkdown(entry.executor.tag)})`;
        if (includeReason && entry.reason) out += `\n**Reason:** ${escapeMarkdown(entry.reason)}`;
        return out;
    },

    // Message caching and events
    extractmessage(message) {
        const attachments = message.attachments
            ? [...message.attachments.values()].map(a => ({ name: a.name || 'file', url: a.url }))
            : [];
        const stickers = message.stickers
            ? [...message.stickers.values()].map(s => s.name)
            : [];
        return {
            id: message.id,
            channelId: message.channelId,
            authorId: message.author ? message.author.id : null,
            tag: message.author ? message.author.tag : 'Unknown',
            avatar: message.author && typeof message.author.displayAvatarURL === 'function' ? message.author.displayAvatarURL() : null,
            content: message.content || '',
            attachments,
            stickers,
            createdTimestamp: message.createdTimestamp || Date.now()
        };
    },
    storemessage(entry) {
        if (!entry || !entry.id) return;
        if (this.cache.has(entry.id)) this.cache.delete(entry.id);
        this.cache.set(entry.id, entry);
        while (this.cache.size > this.config.cache) {
            const oldest = this.cache.keys().next().value;
            this.cache.delete(oldest);
        }
        this.touch();
    },
    async messagecreate(message) {
        if (!message.guild || message.system || message.webhookId || (message.author && message.author.bot)) return;
        if (this.isignored(message.channel)) return;
        this.storemessage(this.extractmessage(message));
    },
    async messageupdate(oldmsg, newmsg) {
        if (newmsg.partial) {
            const fetched = await newmsg.fetch().catch(() => null);
            if (!fetched) return;
            newmsg = fetched;
        }
        if (!newmsg.guild || newmsg.system || newmsg.webhookId || (newmsg.author && newmsg.author.bot)) return;
        if (this.isignored(newmsg.channel)) return;

        const cached = this.cache.get(newmsg.id);
        const before = cached ? cached.content : (oldmsg && !oldmsg.partial ? oldmsg.content : null);
        const after = newmsg.content || '';

        this.storemessage(this.extractmessage(newmsg));

        if (!this.enabled('messages')) return;
        if (before !== null && before === after) return;

        const fields = [
            { name: 'Before', value: before !== null ? this.trunc(before) : '*Not cached*' },
            { name: 'After', value: this.trunc(after) }
        ];
        this.send({
            color: this.config.colours.update,
            author: this.userauthor(newmsg.author),
            title: `Message edited in #${newmsg.channel.name || newmsg.channelId}`,
            description: `**Author:** <@${newmsg.author.id}> (${escapeMarkdown(newmsg.author.tag)})\n**Channel:** <#${newmsg.channelId}> • [Jump to message](${newmsg.url})`,
            fields,
            footer: { text: `Author: ${newmsg.author.id} | Message ID: ${newmsg.id}` }
        });
    },
    async messagedelete(message) {
        if (!message.guild && (!message.channel || !message.channel.guild)) return;
        if (this.isignored(message.channel || message.channelId)) return;

        const cached = this.cache.get(message.id);
        if (cached) {
            this.cache.delete(message.id);
            this.touch();
        }
        if (!cached && (message.system || message.webhookId || (message.author && message.author.bot))) return;
        if (!this.enabled('messages')) return;

        const guild = message.guild || message.channel.guild;
        const authorId = cached ? cached.authorId : (message.author ? message.author.id : null);
        const tag = cached ? cached.tag : (message.author ? message.author.tag : null);
        const avatar = cached ? cached.avatar : (message.author && typeof message.author.displayAvatarURL === 'function' ? message.author.displayAvatarURL() : null);
        const content = cached ? cached.content : (!message.partial && message.content ? message.content : null);
        const attachments = cached ? cached.attachments : (message.attachments ? [...message.attachments.values()].map(a => ({ name: a.name || 'file', url: a.url })) : []);
        const stickers = cached ? cached.stickers : (message.stickers ? [...message.stickers.values()].map(s => s.name) : []);
        const created = cached ? cached.createdTimestamp : message.createdTimestamp;

        const entry = authorId
            ? await this.fetchlog(guild, AuditLogEvent.MessageDelete, authorId, e => !e.extra || !e.extra.channel || e.extra.channel.id === message.channelId)
            : null;

        const header = [];
        if (authorId) header.push(`**Author:** <@${authorId}> (${escapeMarkdown(tag || authorId)})`);
        header.push(`**Channel:** <#${message.channelId}>`);
        if (created) header.push(`**Sent:** <t:${Math.floor(created / 1000)}:R>`);

        const body = content !== null
            ? (content.length ? content : '*Empty message*')
            : '*Message content was not cached.*';
        const desc = this.trunc(`${header.join(' • ')}\n\n${body}`, DISCORD_EMBEDSIZE);

        const fields = [];
        if (attachments && attachments.length) {
            fields.push({
                name: `Attachments (${attachments.length})`,
                value: this.trunc(attachments.map(a => `[${escapeMarkdown(a.name)}](${a.url})`).join('\n'))
            });
        }
        if (stickers && stickers.length) {
            fields.push({
                name: `Stickers (${stickers.length})`,
                value: this.trunc(stickers.map(s => escapeMarkdown(s)).join(', '))
            });
        }
        if (entry && entry.executorId && String(entry.executorId) !== String(authorId)) {
            fields.push({ name: 'Deleted by', value: this.formatmod(entry) });
        }

        const chanName = message.channel && message.channel.name ? `#${message.channel.name}` : `<#${message.channelId}>`;
        this.send({
            color: this.config.colours.delete,
            author: authorId ? { name: tag || String(authorId), icon_url: avatar || undefined } : this.guildauthor(guild),
            title: `Message deleted in ${chanName}`,
            description: desc,
            fields: fields.length ? fields : undefined,
            footer: { text: authorId ? `Author: ${authorId} | Message ID: ${message.id}` : `Message ID: ${message.id}` }
        });
    },
    async messagebulkdelete(messages, channel) {
        if (!channel || !channel.guild || this.isignored(channel)) return;
        const sorted = [...messages.values()].sort((a, b) => (a.createdTimestamp || 0) - (b.createdTimestamp || 0));
        const lines = [];
        let touched = false;

        for (const msg of sorted) {
            const cached = this.cache.get(msg.id);
            if (cached) {
                this.cache.delete(msg.id);
                touched = true;
            }
            if (!cached && (msg.webhookId || (msg.author && msg.author.bot))) continue;
            const tag = cached ? cached.tag : (msg.author ? msg.author.tag : 'Uncached');
            const content = cached ? cached.content : (!msg.partial && msg.content ? msg.content : '');
            const att = cached && cached.attachments && cached.attachments.length ? ` [${cached.attachments.map(a => a.name).join(', ')}]` : '';
            const text = (content || att) ? `${content}${att}`.replace(/\n+/g, ' ') : '*[not cached]*';
            lines.push(`**${escapeMarkdown(tag)}:** ${text}`);
        }
        if (touched) this.touch();
        if (!this.enabled('messages')) return;

        const entry = await this.fetchlog(channel.guild, AuditLogEvent.MessageBulkDelete, channel.id);
        const body = lines.length ? `\n\n${lines.join('\n')}` : '';
        const fields = [];
        if (entry && entry.executorId) {
            fields.push({ name: 'Deleted by', value: this.formatmod(entry) });
        }

        this.send({
            color: this.config.colours.delete,
            author: this.guildauthor(channel.guild),
            title: `${messages.size} messages bulk deleted in #${channel.name || channel.id}`,
            description: this.trunc(`**Channel:** <#${channel.id}>${body}`, DISCORD_EMBEDSIZE),
            fields: fields.length ? fields : undefined,
            footer: { text: `Channel ID: ${channel.id}` }
        });
    },

    // Member & Moderation events
    memberadd(member) {
        if (!member || !member.guild || !this.enabled('members')) return;
        const created = Math.floor(member.user.createdTimestamp / 1000);
        const count = member.guild.members.cache.filter(m => !m.user.bot).size;
        this.send({
            color: this.config.colours.create,
            author: this.userauthor(member.user),
            title: 'Member joined',
            thumbnail: { url: member.user.displayAvatarURL() },
            description: `<@${member.id}> (${escapeMarkdown(member.user.tag)})`,
            fields: [
                { name: 'Account Created', value: `<t:${created}:F> (<t:${created}:R>)`, inline: true },
                { name: 'Member Count', value: `#${count}`, inline: true }
            ],
            footer: { text: `ID: ${member.id}` }
        });
    },
    async memberremove(member) {
        if (!member || !member.guild) return { kick: null, ban: null };
        if (this.config && this.config.delay > 0) await this.wait(this.config.delay);
        if (this.stopped) return { kick: null, ban: null };

        let kick = null;
        let ban = null;
        try {
            const [kicks, bans] = await Promise.all([
                member.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberKick }).catch(() => null),
                member.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberBanAdd }).catch(() => null)
            ]);
            const now = Date.now();
            if (kicks) {
                kick = kicks.entries.find(e => String(e.targetId) === String(member.id) && now - e.createdTimestamp <= this.config.window) || null;
            }
            if (bans) {
                ban = bans.entries.find(e => String(e.targetId) === String(member.id) && now - e.createdTimestamp <= this.config.window) || null;
            }
        }
        catch {
            // Audit log unavailable
        }

        if (this.enabled('members')) {
            const fields = [];
            if (member.joinedTimestamp) {
                const joined = Math.floor(member.joinedTimestamp / 1000);
                fields.push({ name: 'Joined Server', value: `<t:${joined}:F> (<t:${joined}:R>)`, inline: true });
            }
            if (member.roles && member.roles.cache) {
                const roles = member.roles.cache
                    .filter(r => r.id !== member.guild.id)
                    .map(r => `<@&${r.id}>`);
                if (roles.length) {
                    fields.push({ name: `Roles (${roles.length})`, value: this.trunc(roles.join(' ')) });
                }
            }
            this.send({
                color: this.config.colours.delete,
                author: this.userauthor(member.user),
                title: 'Member left',
                thumbnail: { url: member.user.displayAvatarURL() },
                description: `<@${member.id}> (${escapeMarkdown(member.user.tag)})`,
                fields: fields.length ? fields : undefined,
                footer: { text: `ID: ${member.id}` }
            });
        }

        if (kick && this.enabled('moderation')) {
            const fields = [];
            if (kick.executorId) fields.push({ name: 'Moderator', value: this.formatmod(kick, false), inline: true });
            fields.push({ name: 'Reason', value: kick.reason ? this.trunc(escapeMarkdown(kick.reason)) : 'No reason provided', inline: true });
            this.send({
                color: this.config.colours.mod,
                author: this.userauthor(member.user),
                title: 'Member kicked',
                thumbnail: { url: member.user.displayAvatarURL() },
                description: `<@${member.id}> (${escapeMarkdown(member.user.tag)})`,
                fields,
                footer: { text: `ID: ${member.id}` }
            });
        }

        return { kick, ban };
    },
    banadd(ban, entry) {
        if (!ban || !ban.guild || !this.enabled('moderation')) return;
        const fields = [];
        if (entry && entry.executorId) fields.push({ name: 'Moderator', value: this.formatmod(entry, false), inline: true });
        const reason = (entry && entry.reason) || ban.reason;
        fields.push({ name: 'Reason', value: reason ? this.trunc(escapeMarkdown(reason)) : 'No reason provided', inline: true });
        this.send({
            color: this.config.colours.delete,
            author: this.userauthor(ban.user),
            title: 'Member banned',
            thumbnail: { url: ban.user.displayAvatarURL() },
            description: `<@${ban.user.id}> (${escapeMarkdown(ban.user.tag)})`,
            fields,
            footer: { text: `ID: ${ban.user.id}` }
        });
    },
    banremove(ban, entry) {
        if (!ban || !ban.guild || !this.enabled('moderation')) return;
        const fields = [];
        if (entry && entry.executorId) fields.push({ name: 'Moderator', value: this.formatmod(entry, false), inline: true });
        if (entry && entry.reason) fields.push({ name: 'Reason', value: this.trunc(escapeMarkdown(entry.reason)), inline: true });
        this.send({
            color: this.config.colours.create,
            author: this.userauthor(ban.user),
            title: 'Member unbanned',
            thumbnail: { url: ban.user.displayAvatarURL() },
            description: `<@${ban.user.id}> (${escapeMarkdown(ban.user.tag)})`,
            fields: fields.length ? fields : undefined,
            footer: { text: `ID: ${ban.user.id}` }
        });
    },
    async memberupdate(oldmember, member) {
        if (!member || !member.guild || oldmember.partial) return;

        // Timeouts (moderation category)
        const oldTimeout = oldmember.communicationDisabledUntilTimestamp || 0;
        const newTimeout = member.communicationDisabledUntilTimestamp || 0;
        const now = Date.now();
        if (oldTimeout !== newTimeout && this.enabled('moderation')) {
            const entry = await this.fetchlog(member.guild, AuditLogEvent.MemberUpdate, member.id, e => e.changes && e.changes.some(c => c.key === 'communication_disabled_until'));
            if (newTimeout > now) {
                const until = Math.floor(newTimeout / 1000);
                const fields = [
                    { name: 'Until', value: `<t:${until}:F> (<t:${until}:R>)`, inline: true }
                ];
                if (entry && entry.executorId) fields.push({ name: 'Moderator', value: this.formatmod(entry, false), inline: true });
                if (entry && entry.reason) fields.push({ name: 'Reason', value: this.trunc(escapeMarkdown(entry.reason)) });
                this.send({
                    color: this.config.colours.mod,
                    author: this.userauthor(member.user),
                    title: 'Member timed out',
                    description: `<@${member.id}> (${escapeMarkdown(member.user.tag)})`,
                    fields,
                    footer: { text: `ID: ${member.id}` }
                });
            }
            else if (oldTimeout > now) {
                const fields = [];
                if (entry && entry.executorId) fields.push({ name: 'Moderator', value: this.formatmod(entry, false), inline: true });
                if (entry && entry.reason) fields.push({ name: 'Reason', value: this.trunc(escapeMarkdown(entry.reason)) });
                this.send({
                    color: this.config.colours.create,
                    author: this.userauthor(member.user),
                    title: 'Timeout removed',
                    description: `<@${member.id}> (${escapeMarkdown(member.user.tag)})`,
                    fields: fields.length ? fields : undefined,
                    footer: { text: `ID: ${member.id}` }
                });
            }
        }

        if (!this.enabled('members')) return;

        // Nickname changes
        if (oldmember.nickname !== member.nickname) {
            const entry = await this.fetchlog(member.guild, AuditLogEvent.MemberUpdate, member.id, e => e.changes && e.changes.some(c => c.key === 'nick'));
            const fields = [
                { name: 'Before', value: oldmember.nickname ? escapeMarkdown(oldmember.nickname) : '*None*', inline: true },
                { name: 'After', value: member.nickname ? escapeMarkdown(member.nickname) : '*None*', inline: true }
            ];
            if (entry && entry.executorId && String(entry.executorId) !== String(member.id)) {
                fields.push({ name: 'Changed by', value: this.formatmod(entry) });
            }
            this.send({
                color: this.config.colours.update,
                author: this.userauthor(member.user),
                title: 'Nickname changed',
                description: `<@${member.id}> (${escapeMarkdown(member.user.tag)})`,
                fields,
                footer: { text: `ID: ${member.id}` }
            });
        }

        // Role additions and removals
        if (oldmember.roles && member.roles) {
            const added = member.roles.cache.filter(r => r.id !== member.guild.id && !oldmember.roles.cache.has(r.id));
            const removed = oldmember.roles.cache.filter(r => r.id !== member.guild.id && !member.roles.cache.has(r.id));
            if (added.size > 0 || removed.size > 0) {
                const entry = await this.fetchlog(member.guild, AuditLogEvent.MemberRoleUpdate, member.id);
                const fields = [];
                if (added.size > 0) fields.push({ name: 'Added', value: this.trunc(added.map(r => `<@&${r.id}>`).join(' ')) });
                if (removed.size > 0) fields.push({ name: 'Removed', value: this.trunc(removed.map(r => `<@&${r.id}>`).join(' ')) });
                if (entry && entry.executorId) fields.push({ name: 'Updated by', value: this.formatmod(entry) });
                this.send({
                    color: this.config.colours.update,
                    author: this.userauthor(member.user),
                    title: 'Member roles updated',
                    description: `<@${member.id}> (${escapeMarkdown(member.user.tag)})`,
                    fields,
                    footer: { text: `ID: ${member.id}` }
                });
            }
        }

        // Server-specific avatar changes
        if (oldmember.avatar !== member.avatar) {
            this.send({
                color: this.config.colours.update,
                author: this.userauthor(member.user),
                title: 'Server avatar changed',
                thumbnail: { url: member.displayAvatarURL() },
                description: `<@${member.id}> (${escapeMarkdown(member.user.tag)})`,
                footer: { text: `ID: ${member.id}` }
            });
        }
    },
    async userupdate(olduser, user) {
        if (!user || olduser.partial || !this.enabled('members')) return;
        const guild = this.bot.guilds.cache.get(this.bot.config.guildId);
        if (!guild || !guild.members.cache.has(user.id)) return;

        const fields = [];
        if (olduser.username !== user.username) {
            fields.push({ name: 'Username', value: `${escapeMarkdown(olduser.username || '*None*')} → ${escapeMarkdown(user.username || '*None*')}`, inline: true });
        }
        if (olduser.globalName !== user.globalName) {
            fields.push({ name: 'Display Name', value: `${escapeMarkdown(olduser.globalName || '*None*')} → ${escapeMarkdown(user.globalName || '*None*')}`, inline: true });
        }
        const avatarChanged = olduser.avatar !== user.avatar;
        if (avatarChanged) {
            fields.push({ name: 'Avatar', value: 'Updated', inline: true });
        }
        if (!fields.length) return;

        this.send({
            color: this.config.colours.update,
            author: this.userauthor(user),
            title: 'User profile updated',
            thumbnail: avatarChanged ? { url: user.displayAvatarURL() } : undefined,
            description: `<@${user.id}> (${escapeMarkdown(user.tag)})`,
            fields,
            footer: { text: `ID: ${user.id}` }
        });
    },

    // Channel events
    channeltype(type) {
        return CHANNEL_TYPES[type] || `Channel (${type})`;
    },
    overwritetarget(overwrite) {
        return overwrite.type === OverwriteType.Role ? `<@&${overwrite.id}>` : `<@${overwrite.id}>`;
    },
    diffoverwrites(oldchan, newchan) {
        if (!oldchan.permissionOverwrites || !newchan.permissionOverwrites) return [];
        const oldmap = oldchan.permissionOverwrites.cache;
        const newmap = newchan.permissionOverwrites.cache;
        const lines = [];

        for (const [id, nw] of newmap) {
            const target = this.overwritetarget(nw);
            const old = oldmap.get(id);
            if (!old) {
                const allow = nw.allow.toArray();
                const deny = nw.deny.toArray();
                const parts = [];
                if (allow.length) parts.push(`✅ ${allow.join(', ')}`);
                if (deny.length) parts.push(`❌ ${deny.join(', ')}`);
                lines.push(`**Added ${target}:** ${parts.join(' | ') || 'Neutral'}`);
                continue;
            }
            if (old.allow.bitfield === nw.allow.bitfield && old.deny.bitfield === nw.deny.bitfield) continue;
            const changes = [];
            for (const perm of Object.keys(PermissionsBitField.Flags)) {
                const wasAllow = old.allow.has(perm);
                const wasDeny = old.deny.has(perm);
                const isAllow = nw.allow.has(perm);
                const isDeny = nw.deny.has(perm);
                if (wasAllow === isAllow && wasDeny === isDeny) continue;
                const state = isAllow ? '✅' : (isDeny ? '❌' : '⬜');
                changes.push(`${state} \`${perm}\``);
            }
            if (changes.length) lines.push(`**${target}:** ${changes.join(', ')}`);
        }
        for (const [id, old] of oldmap) {
            if (!newmap.has(id)) {
                lines.push(`**Removed ${this.overwritetarget(old)}**`);
            }
        }
        return lines;
    },
    async channelcreate(channel) {
        if (!channel.guild || !this.enabled('channels')) return;
        const entry = await this.fetchlog(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
        const fields = [
            { name: 'Type', value: this.channeltype(channel.type), inline: true }
        ];
        if (channel.parent) fields.push({ name: 'Category', value: escapeMarkdown(channel.parent.name), inline: true });
        if (entry && entry.executorId) fields.push({ name: 'Created by', value: this.formatmod(entry), inline: true });

        this.send({
            color: this.config.colours.create,
            author: this.guildauthor(channel.guild),
            title: `${this.channeltype(channel.type)} created`,
            description: `<#${channel.id}> (\`${escapeMarkdown(channel.name)}\`)`,
            fields,
            footer: { text: `Channel ID: ${channel.id}` }
        });
    },
    async channeldelete(channel) {
        if (!channel.guild || !this.enabled('channels')) return;
        const entry = await this.fetchlog(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
        const fields = [
            { name: 'Type', value: this.channeltype(channel.type), inline: true }
        ];
        if (channel.parent) fields.push({ name: 'Category', value: escapeMarkdown(channel.parent.name), inline: true });
        if (entry && entry.executorId) fields.push({ name: 'Deleted by', value: this.formatmod(entry), inline: true });

        this.send({
            color: this.config.colours.delete,
            author: this.guildauthor(channel.guild),
            title: `${this.channeltype(channel.type)} deleted`,
            description: `\`#${escapeMarkdown(channel.name)}\``,
            fields,
            footer: { text: `Channel ID: ${channel.id}` }
        });
    },
    async channelupdate(oldchan, newchan) {
        if (!newchan.guild || oldchan.partial || !this.enabled('channels')) return;
        const fields = [];
        if (oldchan.name !== newchan.name) {
            fields.push({ name: 'Name', value: `\`${escapeMarkdown(oldchan.name)}\` → \`${escapeMarkdown(newchan.name)}\``, inline: true });
        }
        if ((oldchan.topic || '') !== (newchan.topic || '')) {
            fields.push({
                name: 'Topic',
                value: this.trunc(`**Before:** ${oldchan.topic ? escapeMarkdown(oldchan.topic) : '*None*'}\n**After:** ${newchan.topic ? escapeMarkdown(newchan.topic) : '*None*'}`)
            });
        }
        if (oldchan.nsfw !== newchan.nsfw) {
            fields.push({ name: 'NSFW', value: `${oldchan.nsfw ? 'Yes' : 'No'} → ${newchan.nsfw ? 'Yes' : 'No'}`, inline: true });
        }
        if ((oldchan.rateLimitPerUser || 0) !== (newchan.rateLimitPerUser || 0)) {
            fields.push({ name: 'Slowmode', value: `${global.tools.dur(oldchan.rateLimitPerUser || 0)} → ${global.tools.dur(newchan.rateLimitPerUser || 0)}`, inline: true });
        }
        if (oldchan.parentId !== newchan.parentId) {
            const oldCat = oldchan.parent ? escapeMarkdown(oldchan.parent.name) : '*None*';
            const newCat = newchan.parent ? escapeMarkdown(newchan.parent.name) : '*None*';
            fields.push({ name: 'Category', value: `${oldCat} → ${newCat}`, inline: true });
        }
        if (oldchan.bitrate !== newchan.bitrate) {
            fields.push({ name: 'Bitrate', value: `${Math.round((oldchan.bitrate || 0) / 1000)}kbps → ${Math.round((newchan.bitrate || 0) / 1000)}kbps`, inline: true });
        }
        if (oldchan.userLimit !== newchan.userLimit) {
            fields.push({ name: 'User Limit', value: `${oldchan.userLimit || 'Unlimited'} → ${newchan.userLimit || 'Unlimited'}`, inline: true });
        }
        const overwrites = this.diffoverwrites(oldchan, newchan);
        if (overwrites.length) {
            fields.push({ name: 'Permission Overwrites', value: this.trunc(overwrites.join('\n')) });
        }
        if (!fields.length) return;

        let entry = await this.fetchlog(newchan.guild, AuditLogEvent.ChannelUpdate, newchan.id);
        if (!entry && overwrites.length) {
            entry = await this.fetchlog(newchan.guild, AuditLogEvent.ChannelOverwriteUpdate, newchan.id)
                || await this.fetchlog(newchan.guild, AuditLogEvent.ChannelOverwriteCreate, newchan.id)
                || await this.fetchlog(newchan.guild, AuditLogEvent.ChannelOverwriteDelete, newchan.id);
        }
        if (entry && entry.executorId) fields.push({ name: 'Updated by', value: this.formatmod(entry) });

        this.send({
            color: this.config.colours.update,
            author: this.guildauthor(newchan.guild),
            title: `${this.channeltype(newchan.type)} updated`,
            description: `<#${newchan.id}> (\`${escapeMarkdown(newchan.name)}\`)`,
            fields,
            footer: { text: `Channel ID: ${newchan.id}` }
        });
    },

    // Role events
    async rolecreate(role) {
        if (!role.guild || !this.enabled('roles')) return;
        const entry = await this.fetchlog(role.guild, AuditLogEvent.RoleCreate, role.id);
        const fields = [];
        if (entry && entry.executorId) fields.push({ name: 'Created by', value: this.formatmod(entry), inline: true });

        this.send({
            color: role.color || this.config.colours.create,
            author: this.guildauthor(role.guild),
            title: 'Role created',
            description: `<@&${role.id}> (\`${escapeMarkdown(role.name)}\`)`,
            fields: fields.length ? fields : undefined,
            footer: { text: `Role ID: ${role.id}` }
        });
    },
    async roledelete(role) {
        if (!role.guild || !this.enabled('roles')) return;
        const entry = await this.fetchlog(role.guild, AuditLogEvent.RoleDelete, role.id);
        const fields = [
            { name: 'Color', value: role.hexColor, inline: true }
        ];
        if (entry && entry.executorId) fields.push({ name: 'Deleted by', value: this.formatmod(entry), inline: true });

        this.send({
            color: role.color || this.config.colours.delete,
            author: this.guildauthor(role.guild),
            title: 'Role deleted',
            description: `\`@${escapeMarkdown(role.name)}\``,
            fields,
            footer: { text: `Role ID: ${role.id}` }
        });
    },
    async roleupdate(oldrole, newrole) {
        if (!newrole.guild || !this.enabled('roles')) return;
        const fields = [];
        if (oldrole.name !== newrole.name) {
            fields.push({ name: 'Name', value: `\`${escapeMarkdown(oldrole.name)}\` → \`${escapeMarkdown(newrole.name)}\``, inline: true });
        }
        if (oldrole.hexColor !== newrole.hexColor) {
            fields.push({ name: 'Color', value: `\`${oldrole.hexColor}\` → \`${newrole.hexColor}\``, inline: true });
        }
        if (oldrole.hoist !== newrole.hoist) {
            fields.push({ name: 'Hoisted', value: `${oldrole.hoist ? 'Yes' : 'No'} → ${newrole.hoist ? 'Yes' : 'No'}`, inline: true });
        }
        if (oldrole.mentionable !== newrole.mentionable) {
            fields.push({ name: 'Mentionable', value: `${oldrole.mentionable ? 'Yes' : 'No'} → ${newrole.mentionable ? 'Yes' : 'No'}`, inline: true });
        }
        if (oldrole.permissions.bitfield !== newrole.permissions.bitfield) {
            const oldPerms = new Set(oldrole.permissions.toArray());
            const newPerms = new Set(newrole.permissions.toArray());
            const added = [...newPerms].filter(p => !oldPerms.has(p));
            const removed = [...oldPerms].filter(p => !newPerms.has(p));
            const diff = [];
            if (added.length) diff.push(`**Added:** ${added.map(p => `\`${p}\``).join(', ')}`);
            if (removed.length) diff.push(`**Removed:** ${removed.map(p => `\`${p}\``).join(', ')}`);
            if (diff.length) fields.push({ name: 'Permissions', value: this.trunc(diff.join('\n')) });
        }
        if (!fields.length) return;

        const entry = await this.fetchlog(newrole.guild, AuditLogEvent.RoleUpdate, newrole.id);
        if (entry && entry.executorId) fields.push({ name: 'Updated by', value: this.formatmod(entry) });

        this.send({
            color: newrole.color || this.config.colours.update,
            author: this.guildauthor(newrole.guild),
            title: 'Role updated',
            description: `<@&${newrole.id}> (\`${escapeMarkdown(newrole.name)}\`)`,
            fields,
            footer: { text: `Role ID: ${newrole.id}` }
        });
    },

    // Thread events
    isrelaythread(thread) {
        if (!thread || !this.bot || !this.bot.config) return false;
        const relay = (this.bot.config.auth && this.bot.config.auth.relay) || (this.bot.config.channels && this.bot.config.channels.relay);
        return Boolean(relay && String(thread.parentId) === String(relay));
    },
    async threadcreate(thread, newlyCreated) {
        if (!newlyCreated || !thread.guild || !this.enabled('threads')) return;
        if (this.isrelaythread(thread) && String(thread.ownerId) === String(this.bot.user.id)) return;
        const fields = [];
        if (thread.parentId) fields.push({ name: 'Parent', value: `<#${thread.parentId}>`, inline: true });
        if (thread.ownerId) fields.push({ name: 'Created by', value: `<@${thread.ownerId}>`, inline: true });

        this.send({
            color: this.config.colours.create,
            author: this.guildauthor(thread.guild),
            title: 'Thread created',
            description: `<#${thread.id}> (\`${escapeMarkdown(thread.name)}\`)`,
            fields: fields.length ? fields : undefined,
            footer: { text: `Thread ID: ${thread.id}` }
        });
    },
    async threaddelete(thread) {
        if (!thread.guild || !this.enabled('threads')) return;
        const entry = await this.fetchlog(thread.guild, AuditLogEvent.ThreadDelete, thread.id);
        const fields = [];
        if (thread.parentId) fields.push({ name: 'Parent', value: `<#${thread.parentId}>`, inline: true });
        if (entry && entry.executorId) fields.push({ name: 'Deleted by', value: this.formatmod(entry), inline: true });

        this.send({
            color: this.config.colours.delete,
            author: this.guildauthor(thread.guild),
            title: 'Thread deleted',
            description: `\`${escapeMarkdown(thread.name || thread.id)}\``,
            fields: fields.length ? fields : undefined,
            footer: { text: `Thread ID: ${thread.id}` }
        });
    },
    async threadupdate(oldthread, newthread) {
        if (!newthread.guild || oldthread.partial || !this.enabled('threads')) return;
        const nameChanged = oldthread.name !== newthread.name;
        const lockChanged = oldthread.locked !== newthread.locked;
        const rateChanged = (oldthread.rateLimitPerUser || 0) !== (newthread.rateLimitPerUser || 0);
        const archChanged = oldthread.archived !== newthread.archived;
        if (!nameChanged && !lockChanged && !rateChanged && !archChanged) return;

        const entry = await this.fetchlog(newthread.guild, AuditLogEvent.ThreadUpdate, newthread.id);
        const byBot = entry && String(entry.executorId) === String(this.bot.user.id);

        // Ignore bridge/matchmaking thread renames and unarchives in the relay forum
        if (this.isrelaythread(newthread) && !lockChanged && !rateChanged && (!entry || byBot)) return;
        // Ignore automatic inactivity archiving or message-triggered unarchiving when nothing else changed
        if (!nameChanged && !lockChanged && !rateChanged && archChanged && (!entry || byBot)) return;

        const fields = [];
        if (nameChanged) fields.push({ name: 'Name', value: `\`${escapeMarkdown(oldthread.name)}\` → \`${escapeMarkdown(newthread.name)}\``, inline: true });
        if (lockChanged) fields.push({ name: 'Locked', value: `${oldthread.locked ? 'Yes' : 'No'} → ${newthread.locked ? 'Yes' : 'No'}`, inline: true });
        if (rateChanged) fields.push({ name: 'Slowmode', value: `${global.tools.dur(oldthread.rateLimitPerUser || 0)} → ${global.tools.dur(newthread.rateLimitPerUser || 0)}`, inline: true });
        if (archChanged) fields.push({ name: 'Archived', value: `${oldthread.archived ? 'Yes' : 'No'} → ${newthread.archived ? 'Yes' : 'No'}`, inline: true });
        if (entry && entry.executorId) fields.push({ name: 'Updated by', value: this.formatmod(entry) });

        this.send({
            color: this.config.colours.update,
            author: this.guildauthor(newthread.guild),
            title: 'Thread updated',
            description: `<#${newthread.id}> (\`${escapeMarkdown(newthread.name)}\`)`,
            fields,
            footer: { text: `Thread ID: ${newthread.id}` }
        });
    },

    // Emoji & Sticker events
    async emojicreate(emoji) {
        if (!emoji.guild || !this.enabled('expressions')) return;
        const entry = await this.fetchlog(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);
        const fields = [];
        if (entry && entry.executorId) fields.push({ name: 'Created by', value: this.formatmod(entry), inline: true });

        this.send({
            color: this.config.colours.create,
            author: this.guildauthor(emoji.guild),
            title: 'Emoji created',
            thumbnail: { url: emoji.imageURL() },
            description: `${emoji} (\`:${escapeMarkdown(emoji.name)}:\`)`,
            fields: fields.length ? fields : undefined,
            footer: { text: `Emoji ID: ${emoji.id}` }
        });
    },
    async emojidelete(emoji) {
        if (!emoji.guild || !this.enabled('expressions')) return;
        const entry = await this.fetchlog(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);
        const fields = [];
        if (entry && entry.executorId) fields.push({ name: 'Deleted by', value: this.formatmod(entry), inline: true });

        this.send({
            color: this.config.colours.delete,
            author: this.guildauthor(emoji.guild),
            title: 'Emoji deleted',
            thumbnail: { url: emoji.imageURL() },
            description: `\`:${escapeMarkdown(emoji.name)}:\``,
            fields: fields.length ? fields : undefined,
            footer: { text: `Emoji ID: ${emoji.id}` }
        });
    },
    async emojiupdate(oldemoji, newemoji) {
        if (!newemoji.guild || oldemoji.name === newemoji.name || !this.enabled('expressions')) return;
        const entry = await this.fetchlog(newemoji.guild, AuditLogEvent.EmojiUpdate, newemoji.id);
        const fields = [
            { name: 'Name', value: `\`:${escapeMarkdown(oldemoji.name)}:\` → \`:${escapeMarkdown(newemoji.name)}:\``, inline: true }
        ];
        if (entry && entry.executorId) fields.push({ name: 'Updated by', value: this.formatmod(entry), inline: true });

        this.send({
            color: this.config.colours.update,
            author: this.guildauthor(newemoji.guild),
            title: 'Emoji updated',
            thumbnail: { url: newemoji.imageURL() },
            description: `${newemoji} (\`:${escapeMarkdown(newemoji.name)}:\`)`,
            fields,
            footer: { text: `Emoji ID: ${newemoji.id}` }
        });
    },
    async stickercreate(sticker) {
        if (!sticker.guild || !this.enabled('expressions')) return;
        const entry = await this.fetchlog(sticker.guild, AuditLogEvent.StickerCreate, sticker.id);
        const fields = [];
        if (sticker.description) fields.push({ name: 'Description', value: this.trunc(escapeMarkdown(sticker.description)), inline: true });
        if (entry && entry.executorId) fields.push({ name: 'Created by', value: this.formatmod(entry), inline: true });

        this.send({
            color: this.config.colours.create,
            author: this.guildauthor(sticker.guild),
            title: 'Sticker created',
            thumbnail: { url: sticker.url },
            description: `\`${escapeMarkdown(sticker.name)}\``,
            fields: fields.length ? fields : undefined,
            footer: { text: `Sticker ID: ${sticker.id}` }
        });
    },
    async stickerdelete(sticker) {
        if (!sticker.guild || !this.enabled('expressions')) return;
        const entry = await this.fetchlog(sticker.guild, AuditLogEvent.StickerDelete, sticker.id);
        const fields = [];
        if (entry && entry.executorId) fields.push({ name: 'Deleted by', value: this.formatmod(entry), inline: true });

        this.send({
            color: this.config.colours.delete,
            author: this.guildauthor(sticker.guild),
            title: 'Sticker deleted',
            description: `\`${escapeMarkdown(sticker.name)}\``,
            fields: fields.length ? fields : undefined,
            footer: { text: `Sticker ID: ${sticker.id}` }
        });
    },
    async stickerupdate(oldsticker, newsticker) {
        if (!newsticker.guild || !this.enabled('expressions')) return;
        const fields = [];
        if (oldsticker.name !== newsticker.name) {
            fields.push({ name: 'Name', value: `\`${escapeMarkdown(oldsticker.name)}\` → \`${escapeMarkdown(newsticker.name)}\``, inline: true });
        }
        if ((oldsticker.description || '') !== (newsticker.description || '')) {
            fields.push({ name: 'Description', value: `${escapeMarkdown(oldsticker.description || '*None*')} → ${escapeMarkdown(newsticker.description || '*None*')}`, inline: true });
        }
        if (!fields.length) return;

        const entry = await this.fetchlog(newsticker.guild, AuditLogEvent.StickerUpdate, newsticker.id);
        if (entry && entry.executorId) fields.push({ name: 'Updated by', value: this.formatmod(entry), inline: true });

        this.send({
            color: this.config.colours.update,
            author: this.guildauthor(newsticker.guild),
            title: 'Sticker updated',
            thumbnail: { url: newsticker.url },
            description: `\`${escapeMarkdown(newsticker.name)}\``,
            fields,
            footer: { text: `Sticker ID: ${newsticker.id}` }
        });
    },

    // Invite events
    async invitecreate(invite) {
        if (!invite.guild || !this.enabled('invites')) return;
        const fields = [
            { name: 'Channel', value: `<#${invite.channelId}>`, inline: true },
            { name: 'Expires', value: invite.maxAge ? global.tools.dur(invite.maxAge) : 'Never', inline: true },
            { name: 'Max Uses', value: invite.maxUses ? String(invite.maxUses) : 'Unlimited', inline: true }
        ];
        if (invite.inviterId) fields.push({ name: 'Created by', value: `<@${invite.inviterId}>`, inline: true });

        this.send({
            color: this.config.colours.create,
            author: invite.inviter ? this.userauthor(invite.inviter) : this.guildauthor(invite.guild),
            title: 'Invite created',
            description: `Code: \`${escapeMarkdown(invite.code)}\``,
            fields,
            footer: { text: `Code: ${invite.code}` }
        });
    },
    async invitedelete(invite) {
        if (!invite.guild || !this.enabled('invites')) return;
        const entry = await this.fetchlog(invite.guild, AuditLogEvent.InviteDelete, null, e => e.changes && e.changes.some(c => c.key === 'code' && c.old === invite.code));
        const fields = [
            { name: 'Channel', value: `<#${invite.channelId}>`, inline: true }
        ];
        if (entry && entry.executorId) fields.push({ name: 'Deleted by', value: this.formatmod(entry), inline: true });

        this.send({
            color: this.config.colours.delete,
            author: this.guildauthor(invite.guild),
            title: 'Invite deleted',
            description: `Code: \`${escapeMarkdown(invite.code)}\``,
            fields,
            footer: { text: `Code: ${invite.code}` }
        });
    }
};
