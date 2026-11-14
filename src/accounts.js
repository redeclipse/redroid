// Red Eclipse accounts on the master: linking a member's Discord account to theirs with a code they got from the account
// page or the game, and unlinking it. Signs in with the bridge's account, whose standing the master's bot routes need
module.exports = {
    name: 'accounts',
    master: null,
    token: null,
    tokenat: 0,
    config: null, // config.accounts
    linked: new Map(), // Discord ID -> { at, account }, the master's answer for a while, null for not linked

    start(bot) {
        const auth = bot.config.auth || {};
        this.config = bot.config.accounts;
        if (!auth.handle || !auth.privkey || !auth.master || !this.config) {
            global.log.out('Accounts: auth.handle, auth.privkey, auth.master and config.accounts are needed, not starting.');
            return false;
        }
        this.bot = bot;
        this.master = auth.master.replace(/\/+$/, '');
        return false;
    },

    // a session from the master's own POST /api/v1/auth, kept while it's young enough to still be good
    async session(fresh) {
        if (!fresh && this.token && Date.now() - this.tokenat < this.config.session) return this.token;
        this.token = global.matchmaking && global.matchmaking.bot ? await global.matchmaking.signin() : null;
        this.tokenat = Date.now();
        return this.token;
    },

    async request(method, path, body) {
        if (!this.master) throw 'Accounts aren\'t set up here.';
        for (let tries = 0; tries < 2; tries++) {
            const token = await this.session(tries > 0);
            if (!token) throw 'The bot couldn\'t sign in to the master server, try again later.';
            const headers = { Authorization: `Bearer ${token}` };
            if (body) headers['Content-Type'] = 'application/json';
            const res = await fetch(`${this.master}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(this.config.timeout) });
            const json = await res.json().catch(() => null);
            if (res.status === 401 && tries === 0) continue; // the session ran out, so sign in again
            return { status: res.status, json };
        }
        return { status: 401, json: null };
    },

    // the account a member linked, { handle, privilege }, or null; asked of the master at most once every config.accounts.cache
    async lookup(user) {
        const known = this.linked.get(user);
        if (known && Date.now() - known.at < this.config.cache) return known.account;
        let account = known ? known.account : null;
        try {
            const res = await this.request('GET', `/api/v1/accounts/discord/${user}`);
            if (res.status === 200 && res.json && res.json.handle) account = { handle: res.json.handle, privilege: res.json.privilege || 'player' };
            else if (res.status === 404) account = null;
        }
        catch (err) {
            global.log.out(`Accounts: couldn't look up ${user}: ${err.message || err}`); // chat goes on without it
        }
        if (this.linked.size > 10000) this.linked.clear();
        this.linked.set(user, { at: Date.now(), account });
        return account;
    },

    async link(user, name, code) {
        const res = await this.request('POST', '/api/v1/accounts/discord/link', { code: code.trim(), discord: user, name });
        this.linked.delete(user);
        if (res.status === 200 && res.json) return res.json;
        throw (res.json && res.json.error) ? `The master server said: ${res.json.error}.` : `The master server answered ${res.status}.`;
    },

    async unlink(user) {
        const res = await this.request('DELETE', `/api/v1/accounts/discord/${user}`);
        this.linked.delete(user);
        if (res.status === 204) return true;
        if (res.status === 404) return false;
        throw (res.json && res.json.error) ? `The master server said: ${res.json.error}.` : `The master server answered ${res.status}.`;
    }
};
