const fs = require('fs');
const { Client, Collection, Intents } = require('discord.js');
const wait = ms => new Promise(_ => setTimeout(_, ms));

global.log = {
    bot: null,
    error(str, ...args) {
        console.error(str, ...args);
        if (this.bot) this.bot.log('ERROR', str, ...args);
    },
    out(str, ...args) {
        console.log(str, ...args);
        if (this.bot) this.bot.log('LOG', str, ...args);
    },
    warn(str, ...args) {
        console.warn(str, ...args);
        if (this.bot) this.bot.log('WARN', str, ...args);
    }
};


class Bot extends Client {
    // Instantiate the Discord client
    constructor() {
        super({
            intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_PRESENCES, Intents.FLAGS.GUILD_MEMBERS],
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
            else {global.log.error('ERROR: Command provides no config.');}
        }

        // Load events and connect their emitters
        const eventfiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
        for (const file of eventfiles) {
            global.log.out(`Loading event: ${file}`);
            const event = require(`./events/${file}`);
            if (event.once) this.once(event.name, (...args) => event.execute(this, ...args));
            else this.on(event.name, (...args) => event.execute(this, ...args));
        }

        // Console redirections
        this.on('error', global.log.error);
        this.on('warn', global.log.warn);
        this.on('debug', global.log.out);

        // Process handlers
        process.on('exit', () => this.shutdown());

        process.on('uncaughtException', (err) => {
            const msg = (err ? err.stack || err : '').toString();
            global.log.error(`Uncaught exception:\n ${msg}`);
            if (this.shuttingdown) {
                this.kill();
                this.emit('shutdown', false);
            }
        });

        process.on('unhandledRejection', err => {
            const msg = (err ? err.stack || err : '').toString();
            global.log.error(`Unhandled rejection:\n ${msg}`);
            console.trace();
            if (this.shuttingdown) {
                this.kill();
                this.emit('shutdown', false);
            }
        });

        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGKILL', () => this.shutdown());
        process.on('SIGHUP', () => this.shutdown(true));
    }

    kill() {
        global.log.bot = null;
        this.online = false;
        this.destroy();
    }

    start() {
        if (!this.config) return false;
        this.login(this.config.token);
        return true;
    }

    shutdown(restart = false) {
        if (this.shuttingdown) return;
        global.log.out('Shutdown request received...');
        this.shuttingdown = true;
        for (const source of global.sources) {
            const src = global[source];
            if (typeof mod === 'object') {
                global.log.out(`Shutting down source: ${src.name ? src.name : source}`);
                if (typeof src.shutdown === 'function') src.shutdown();
            }
        }
        this.kill();
        this.emit('shutdown', restart);
    }

    log(type, str, ...args) {
        if (this.online !== true || !this.config.logId) return;
        const chan = this.channels.cache.get(this.config.logId);
        let msg = `[${type}] ${str}`;
        if (args && args.length > 0) {
            msg += '\n```\n';
            msg += JSON.stringify(args, null, 2);
            msg += '```';
        }
        chan.send(msg);
    }
}

const start = () => {
    const bot = new Bot();
    bot.once('shutdown', (reboot) => {
        if (reboot) {
            global.log.out('Process has exited. Rebooting...');
            wait(3000);
            start();
        }
        else {
            global.log.out('Process has exited cleanly.');
            process.exit(0);
        }
    });
    bot.start();
};

start();
