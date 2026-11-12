const fs = require('fs');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const timestamp = () => '[' + new Date().toISOString() + ']';

global.log = {
    bot: null,
    error(str, ...args) {
        console.error(timestamp() + ' ' + str, ...args);
        if (this.bot) this.bot.log('ERROR', str, ...args);
    },
    out(str, ...args) {
        console.log(timestamp() + ' ' + str, ...args);
        if (this.bot) this.bot.log('LOG', str, ...args);
    },
    warn(str, ...args) {
        console.warn(timestamp() + ' ' + str, ...args);
        if (this.bot) this.bot.log('WARN', str, ...args);
    },
    // Console only, never sent to the log channel
    debug(str, ...args) {
        console.log(timestamp() + ' ' + str, ...args);
    }
};

class Bot extends Client {
    // Instantiate the Discord client
    constructor() {
        super({
            // Guilds: channels, roles, emojis; GuildMembers (privileged): member events and cache; GuildModeration: bans
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildModeration
            ],
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
    }

    kill() {
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
        global.log.out('Shutdown request received...');
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
        // Report to the console only, logging here again could loop
        chan.send(msg).catch(err => console.error(timestamp() + ` Failed to send to log channel: ${err.message}`));
    }
}

let bot = null;

const start = () => {
    bot = new Bot();
    bot.once('shutdown', async (reboot) => {
        if (reboot) {
            global.log.out('Process has exited. Rebooting...');
            await wait(3000);
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
