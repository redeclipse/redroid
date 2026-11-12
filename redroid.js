const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, RESTEvents } = require('discord.js');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const timestamp = () => '[' + new Date().toISOString() + ']';

global.log = {
    bot: null,
    error(str, ...args) {
        console.error(timestamp() + ' ' + str, ...args);
        if (this.bot) this.bot.log('ERROR', str, ...args);
    },
    // Console only
    out(str, ...args) {
        console.log(timestamp() + ' ' + str, ...args);
    },
    // Console and the log channel, for events worth reviewing later
    audit(str, ...args) {
        console.log(timestamp() + ' ' + str, ...args);
        if (this.bot) this.bot.log('LOG', str, ...args);
    },
    warn(str, ...args) {
        console.warn(timestamp() + ' ' + str, ...args);
        if (this.bot) this.bot.log('WARN', str, ...args);
    },
    // Console only, for discord.js debug output
    debug(str, ...args) {
        console.log(timestamp() + ' ' + str, ...args);
    }
};

class Bot extends Client {
    // Instantiate the Discord client
    constructor() {
        super({
            // Guilds: channels, roles, emojis; GuildMembers (privileged): member events and cache; GuildModeration: bans;
            // GuildMessages and MessageContent (privileged): what people write in the bridge's threads
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildModeration,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ],
            rest: {
                invalidRequestWarningInterval: 1000,
                // A channel edit that would wait for a rate limit throws instead, so a thread rename (2 every 10 minutes) can't hold up what's behind it
                rejectOnRateLimit: data => data.method === 'PATCH' && data.route === '/channels/:id'
            }
        });

        // Setup globals
        this.config = require('./config.json');
        this.shuttingdown = this.online = false;
        global.log.bot = this;

        // Load source files and start them
        const srcfiles = fs.readdirSync('./src').filter(file => file.endsWith('.js'));
        global.sources = [];
        for (const file of srcfiles) {
            global.log.out(`Loading source: ${file}`);
            const name = file.slice(0, -3);
            global[name] = require(`./src/${file}`);
            try {
                if (global[name].start(this)) global.sources.push(name);
            }
            catch (e) {
                global.log.error(e);
            }
        }

        // Load commands and add them to the client collection
        this.commands = new Collection();
        const commandfiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
        for (const file of commandfiles) {
            global.log.out(`Loading command: ${file}`);
            const command = require(`./commands/${file}`);
            if (command.config) {
                if (command.config.chat) this.commands.set(command.config.chat.name, command);
                if (command.config.user) this.commands.set(command.config.user.name, command);
                if (command.config.mesg) this.commands.set(command.config.mesg.name, command);
            }
            else {
                global.log.error(`Command provides no config: ${file}`);
            }
        }

        // Load events and connect their emitters
        const eventfiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
        for (const file of eventfiles) {
            global.log.out(`Loading event: ${file}`);
            const event = require(`./events/${file}`);
            if (event.once) this.once(event.name, (...args) => event.execute(this, ...args));
            else this.on(event.name, (...args) => event.execute(this, ...args));
        }

        this.on('debug', msg => global.log.debug(msg));

        // discord.js waits out rate limits itself; each is noted here, and the log channel hears a summary now and then
        this.ratelimits = { count: 0, routes: new Set() };
        this.rest.on(RESTEvents.RateLimited, data => {
            global.log.out(`Rate limited: ${data.method} ${data.route} (${data.scope}${data.global ? ', global' : ''}), limit ${data.limit}, waiting ${data.retryAfter}ms`);
            this.ratelimits.count++;
            this.ratelimits.routes.add(`${data.method} ${data.route}`);
        });
        this.ratesummary = setInterval(() => {
            if (!this.ratelimits.count) return;
            const { count, routes } = this.ratelimits;
            global.log.warn(`Hit ${count} rate ${count === 1 ? 'limit' : 'limits'} on ${routes.size} ${routes.size === 1 ? 'route' : 'routes'} in the last 10 minutes: ${[...routes].join(', ')}`);
            this.ratelimits = { count: 0, routes: new Set() };
        }, 600000);
        // Too many refused requests (401, 403, 429) in 10 minutes gets the bot's address banned by Discord for a while
        this.rest.on(RESTEvents.InvalidRequestWarning, data => {
            global.log.warn(`${data.count} refused requests to Discord in the last 10 minutes, at 10000 it bans the bot's address; ${Math.round(data.remainingTime / 1000)}s until the count resets.`);
        });
    }

    kill() {
        clearInterval(this.ratesummary);
        global.log.bot = null;
        this.online = false;
        return this.destroy();
    }

    start() {
        if (!this.config) return false;
        this.login(this.config.token).catch(err => {
            global.log.error(`Login failed: ${err.message}`);
            this.shutdown();
        });
        return true;
    }

    async shutdown(restart = false) {
        if (this.shuttingdown) return;
        global.log.audit(restart ? 'Restart request received...' : 'Shutdown request received...');
        this.shuttingdown = true;
        for (const source of global.sources) {
            const src = global[source];
            if (typeof src === 'object' && typeof src.shutdown === 'function') {
                global.log.out(`Shutting down source: ${src.name ? src.name : source}`);
                src.shutdown();
            }
        }
        await this.kill();
        this.emit('shutdown', restart);
    }

    log(type, str, ...args) {
        if (this.online !== true || !this.config.channels.log) return;
        const chan = this.channels.cache.get(this.config.channels.log);
        if (!chan) return;
        let msg = `[${type}] ${str}`;
        if (args && args.length > 0) {
            msg += '\n```\n';
            msg += JSON.stringify(args, null, 2);
            msg += '```';
        }
        if (msg.length > 2000) msg = msg.slice(0, 1980) + '\n... (truncated)';
        // Report to the console only, logging here again could loop
        chan.send(msg).catch(err => console.error(timestamp() + ` Failed to send to log channel: ${err.message}`));
    }
}

let bot = null;

// Forget config.json, src, commands and events so a restart picks up changes to them
const unload = () => {
    const modules = path.join(__dirname, 'node_modules') + path.sep;
    for (const key of Object.keys(require.cache)) {
        if (key.startsWith(__dirname + path.sep) && !key.startsWith(modules) && key !== __filename) delete require.cache[key];
    }
};

const start = () => {
    bot = new Bot();
    bot.once('shutdown', async (reboot) => {
        if (reboot) {
            global.log.out('Process has exited. Rebooting...');
            await wait(3000);
            unload();
            start();
        }
        else {
            global.log.out('Process has exited cleanly.');
            process.exit(0);
        }
    });
    bot.start();
};

// Process handlers, registered once and acting on the current bot
const fatal = (what, err) => {
    const msg = (err ? err.stack || err : '').toString();
    global.log.error(`${what}:\n ${msg}`);
    // A failure during shutdown would otherwise leave the process hanging
    if (bot && bot.shuttingdown) process.exit(1);
};
process.on('uncaughtException', err => fatal('Uncaught exception', err));
process.on('unhandledRejection', err => fatal('Unhandled rejection', err));
process.on('SIGINT', () => bot.shutdown());
process.on('SIGTERM', () => bot.shutdown());
process.on('SIGHUP', () => bot.shutdown(true));

start();
