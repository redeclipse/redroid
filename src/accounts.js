// Red Eclipse accounts on the master: which account a member linked their Discord account to, which they do on the
// website's account page. Signs in with the bridge's account, whose standing the master's bot route needs, and gives the
// bridge and matchmaking their Sessions from that sign-in
const crypto = require('crypto');

module.exports = {
    name: 'accounts',
    master: null,
    token: null,
    tokenat: 0,
    config: null, // config.accounts
    linked: new Map(), // Discord ID -> { at, account }, the master's answer for a while, null for not linked
    signintoken: null, // the bot's sign-in on the master
    signinpending: null, // the sign-in under way, which everyone wanting one waits on

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

    async masterpost(path, body, token) {
        const headers = {};
        if (body) headers['Content-Type'] = 'application/json';
        if (token) headers.Authorization = `Bearer ${token}`;
        try {
            const res = await fetch(`${this.master}/api/v1${path}`, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(this.config.timeout) });
            const json = await res.json().catch(() => null);
            return { status: res.status, json, error: json && json.error };
        }
        catch (e) {
            return { status: 0, json: null, error: e.name === 'TimeoutError' ? 'the master took too long to answer' : e.message };
        }
    },

    // The master takes the key's answer to its own challenge hashed with what it's for, so a game server, which never
    // sees one, can't pass it on to sign in as the bot
    signinanswer(privkey, challenge) {
        const raw = global.bridge.answer(privkey, challenge);
        if (!raw) return null;
        return crypto.createHash('sha256').update('Master Sign-in ' + raw.toLowerCase().replace(/^0+(?=.)/, '')).digest('hex');
    },
    async signinfetch() {
        const auth = this.bot.config.auth;
        const chal = await this.masterpost('/signin', { name: auth.handle });
        if (chal.status !== 200 || !chal.json || !chal.json.challenge) throw new Error(`challenge refused (${chal.error || chal.status})`);
        const answer = this.signinanswer(auth.privkey, chal.json.challenge);
        if (!answer) throw new Error('couldn\'t answer the challenge');
        const done = await this.masterpost('/signin', { id: chal.json.id, answer, cookie: false, label: 'Redroid' });
        if (done.status !== 200 || !done.json || !done.json.token) throw new Error(`answer refused (${done.error || done.status})`);
        global.log.out(`Accounts: signed in to the master as ${done.json.name}`);
        this.signintoken = done.json.token;
        return this.signintoken;
    },
    // the bot's sign-in, one at a time however many want it
    signin(fresh) {
        if (fresh) this.signintoken = null;
        if (this.signintoken) return Promise.resolve(this.signintoken);
        if (!this.signinpending) this.signinpending = this.signinfetch().finally(() => { this.signinpending = null; });
        return this.signinpending;
    },
    // a Session from the sign-in, on the master itself, or on the server at host and port, which the master vouches to
    async mastersession(host, port) {
        if (!this.master) return { status: 0, json: null, error: 'accounts aren\'t set up here' };
        const path = host ? `/signin/session/${encodeURIComponent(host)}/${port}` : '/signin/session';
        for (let tries = 0; tries < 2; tries++) {
            let token;
            try {
                token = await this.signin(tries > 0);
            }
            catch (e) {
                return { status: 0, json: null, error: `couldn't sign in to the master: ${e.message}` };
            }
            const res = await this.masterpost(path, null, token);
            if (res.status === 401 && tries === 0) continue; // the sign-in ended, so another
            return res;
        }
        return { status: 401, json: null, error: 'couldn\'t sign in to the master' };
    },

    // a Session on the master, kept while it's young enough to still be good
    async session(fresh) {
        if (!fresh && this.token && Date.now() - this.tokenat < this.config.session) return this.token;
        const res = await this.mastersession();
        this.token = res.status === 200 && res.json && res.json.token ? res.json.token : null;
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

    // the account a member linked as last looked up, { handle, privilege }, or null when unknown or not linked
    cached(user) {
        const known = this.linked.get(user);
        return known ? known.account : null;
    },

    // the account a member linked, { handle, privilege }, or null; asked of the master at most once every config.accounts.cache,
    // or config.accounts.missing while they have none, as they link on the website without the bot hearing of it
    async lookup(user) {
        const known = this.linked.get(user);
        if (known && Date.now() - known.at < (known.account ? this.config.cache : this.config.missing)) return known.account;
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
    }
};
