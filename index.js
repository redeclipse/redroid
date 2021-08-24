const fs = require('fs');
const { Client, Collection, Intents } = require('discord.js');
const wait = ms => new Promise(_ => setTimeout(_, ms));

class Bot extends Client {
    // Instantiate the Discord client
    constructor() {
        super({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_PRESENCES, Intents.FLAGS.GUILD_MEMBERS] });
        this.config = global.config = require('./config.json');
        global.sources = [];

        const srcfiles = fs.readdirSync('./src').filter(file => file.endsWith('.js'));
        for (const file of srcfiles) {
            console.log(`Loading source: ${file}`);
            const name = file.slice(0, -3);
            global[name] = require(`./src/${file}`);
            try {
                if (global[name].init(this)) global.sources.push(name);
            }
            catch (e) {
                console.error(e);
            }
        }

        this.commands = new Collection();
        const commandfiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
        for (const file of commandfiles) {
            console.log(`Loading command: ${file}`);
            const command = require(`./commands/${file}`);
            this.commands.set(command.data.name, command);
        }

        const eventfiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
        for (const file of eventfiles) {
            console.log(`Loading event: ${file}`);
            const event = require(`./events/${file}`);
            if (event.once) this.once(event.name, (...args) => event.execute(this, ...args));
            else this.on(event.name, (...args) => event.execute(this, ...args));
        }

        this.on('error', console.error);
        this.on('warn', console.warn);

        // Process handlers
        process.on('exit', () => this.shutdown());

        process.on('uncaughtException', (err) => {
            const errorMsg = (err ? err.stack || err : '').toString();
            console.error(errorMsg);
        });

        process.on('unhandledRejection', err => {
            console.error('Uncaught Promise error: \n' + err.stack);
        });
    }

    start() {
        if (!this.config) return false;

        this.login(this.config.token);

        return true;
    }

    async shutdown(restart = true) {
        if (this.shutdown) return;
        this.shutdown = true;

        if (this.loaded) {
            await this.destroy();
        }

        this.emit('die', restart);
    }
}

const start = () => {
    const bot = new Bot();

    bot.once('die', async reboot => {
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
