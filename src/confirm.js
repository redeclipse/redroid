const { ButtonStyle, ComponentType } = require('discord.js');

// Paged OK/Cancel confirmation of a removal, shared by the commands that remove entries
module.exports = {
    name: 'confirm',
    pending: {}, // by interaction id; lost on restart
    start() {
        return false;
    },
    sweep() {
        const now = Date.now();
        for (const id of Object.keys(this.pending)) {
            if (now - this.pending[id].created > this.pending[id].ttl) delete this.pending[id];
        }
    },
    blocked(req, level) {
        return req.mass && level < req.level_mass;
    },
    render(req, id, level, page, state, note = null) {
        const look = {
            ask: [ 0x88ffff, `${req.title}\nThis will remove:` ],
            page: [ 0x88ffff, `${req.title}\nATTENTION! This will remove:` ],
            done: [ 0x88ff88, note ],
            failed: [ 0xff8888, note ],
            cancelled: [ 0x8888ff, 'Remove cancelled. Results were:' ],
        }[state];
        const embed = { color: look[0], description: look[1], fields: [], footer: { text: '' } };
        const result = global.tools.embedfields(embed, req.list, page);
        if (result.page.num > 0) embed.footer.text += `[Page ${result.page.cur + 1} of ${result.page.num + 1}] Showing ${result.amount} of ${result.count} match(es).`;
        else embed.footer.text += `There are a total of ${result.count} match(es).`;
        const isblocked = this.blocked(req, level), finished = state !== 'ask' && state !== 'page';
        if (isblocked) embed.footer.text += ` Level ${req.level_mass} required to ${req.massnote}.`;
        const paging = result.page.num <= 0;
        const component = {
            type: ComponentType.ActionRow,
            components: [
                { type: ComponentType.Button, label: 'OK', style: ButtonStyle.Success, custom_id: `${req.command} ${id} ok`, disabled: finished || isblocked },
                { type: ComponentType.Button, label: 'Cancel', style: ButtonStyle.Danger, custom_id: `${req.command} ${id} cancel`, disabled: finished },
                { type: ComponentType.Button, label: '⏪', style: ButtonStyle.Primary, custom_id: `${req.command} ${id} prev`, disabled: paging },
                { type: ComponentType.Button, label: '⏩', style: ButtonStyle.Primary, custom_id: `${req.command} ${id} next`, disabled: paging },
            ]
        };
        return { embeds: [ embed ], components: [ component ], pages: result.page.num };
    },
    // req: command (custom_id prefix), title, list (shown entries), mass (needs level_mass), level_mass, massnote, ttl, apply() (returns the number removed)
    async open(action, req) {
        const level = global.access.level(action.guild, action.user);
        this.sweep();
        const reply = this.render(req, action.id, level, 0, 'ask');
        this.pending[action.id] = { ...req, created: Date.now(), user: action.user.id, page: { cur: 0, num: reply.pages }, state: 'page', note: null };
        await action.reply({ embeds: reply.embeds, components: reply.components });
    },
    async button(action, id, op) {
        this.sweep();
        const req = this.pending[id];
        if (!req) throw 'This request has expired, run the command again.';
        if (action.user.id !== req.user) throw `You are not the author of message '${id}'.`;
        const level = global.access.level(action.guild, action.user), finished = req.state !== 'page';
        switch (op) {
            case 'ok': {
                if (!finished && !this.blocked(req, level)) {
                    try {
                        const ret = req.apply();
                        req.state = 'done';
                        req.note = `Successfully removed ${ret} of ${req.list.length} match(es):`;
                    }
                    catch (err) {
                        if (err instanceof Error) throw err;
                        req.state = 'failed';
                        req.note = `Failed: ${err}`;
                    }
                    break;
                }
                // fall-through
            }
            case 'cancel': {
                if (!finished) req.state = 'cancelled';
                break;
            }
            case 'prev': {
                req.page.cur--;
                if (req.page.cur < 0) req.page.cur = req.page.num;
                break;
            }
            case 'next': {
                req.page.cur++;
                if (req.page.cur > req.page.num) req.page.cur = 0;
                break;
            }
            default: throw `Invalid remove interaction '${op}'.`;
        }
        const reply = this.render(req, id, level, req.page.cur, req.state, req.note);
        await action.update({ embeds: reply.embeds, components: reply.components });
    },
};
