const fs = require('fs');
const { Client, Collection, Intents } = require('discord.js');
const wait = ms => new Promise(_ => setTimeout(_, ms));

class Bot extends Client {
    // Instantiate the Discord client
    constructor() {
        super({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_PRESENCES, Intents.FLAGS.GUILD_MEMBERS] });

        // Setup globals
        this.config = require('./config.json');
        this.shuttingdown = false;
        global.sources = [];

        // Load source files and start them
        const srcfiles = fs.readdirSync('./src').filter(file => file.endsWith('.js'));
        for (const file of srcfiles) {
            console.log(`Loading source: ${file}`);
            const name = file.slice(0, -3);
            global[name] = require(`./src/${file}`);
            try {
                if (global[name].start(this)) global.sources.push(name);
            }
            catch (e) {
                console.error(e);
            }
        }

        // Load commands and add them to the client collection
        this.commands = new Collection();
        const commandfiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
        for (const file of commandfiles) {
            console.log(`Loading command: ${file}`);
            const command = require(`./commands/${file}`);
            this.commands.set(command.data.name, command);
        }

        // Load events and connect their emitters
        const eventfiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
        for (const file of eventfiles) {
            console.log(`Loading event: ${file}`);
            const event = require(`./events/${file}`);
            if (event.once) this.once(event.name, (...args) => event.execute(this, ...args));
            else this.on(event.name, (...args) => event.execute(this, ...args));
        }

        // Console redirections
        this.on('error', console.error);
        this.on('warn', console.warn);
        this.on('debug', console.debug);

        // Process handlers
        process.on('exit', () => this.shutdown());

        process.on('uncaughtException', (err) => {
            const errorMsg = (err ? err.stack || err : '').toString();
            console.error(errorMsg);
            if (this.shuttingdown) {
                if (this.loaded) this.destroy();
                this.emit('shutdown', false);
            }
        });

        process.on('unhandledRejection', err => {
            console.error('Uncaught promise error: \n' + err.stack);
            if (this.shuttingdown) {
                if (this.loaded) this.destroy();
                this.emit('shutdown', false);
            }
        });

        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGKILL', () => this.shutdown());
        process.on('SIGHUP', () => this.shutdown(true));
    }

    start() {
        if (!this.config) return false;
        this.login(this.config.token);
        return true;
    }

    async shutdown(restart = false) {
        if (this.shuttingdown) return;
        console.log('Shutdown request received...');
        this.shuttingdown = true;
        for (const source of global.sources) {
            const src = global[source];
            if (typeof mod === 'object') {
                console.log(`Shutting down source: ${src.name ? src.name : source}`);
                if (typeof src.shutdown === 'function') src.shutdown();
            }
        }
        if (this.loaded) this.destroy();
        this.emit('shutdown', restart);
    }
}

const start = () => {
    const bot = new Bot();
    bot.once('shutdown', async (reboot) => {
        if (reboot) {
            console.log('Process has exited. Rebooting...');
            await wait(3000);
            start();
        }
        else {
            console.log('Process has exited cleanly.');
            process.exit(0);
        }
    });
    bot.start();
};

start();
