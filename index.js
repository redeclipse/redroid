const fs = require('fs');
const { Client, Collection, Intents } = require('discord.js');

// The main bot global
const bot = {
    // Instantiate the Discord client
    client: new Client({
        intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
    }),

    // Load the configuration
    config: require('./config.json'),
    sources: [],

    // Initialise stuff
    init() {
        const srcfiles = fs.readdirSync('./src').filter(file => file.endsWith('.js'));
        for (const file of srcfiles) {
            console.log(`Loading source: ${file}`);
            const name = file.slice(0, -3);
            this[name] = require(`./src/${file}`);
            try {
                if (this[name].init(this)) this.sources.push(name);
            }
            catch (e) {
                console.error(e);
            }
        }

        this.client.commands = new Collection();
        const commandfiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
        for (const file of commandfiles) {
            console.log(`Loading command: ${file}`);
            const command = require(`./commands/${file}`);
            this.client.commands.set(command.data.name, command);
        }

        const eventfiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
        for (const file of eventfiles) {
            console.log(`Loading event: ${file}`);
            const event = require(`./events/${file}`);
            if (event.once) this.client.once(event.name, (...args) => event.execute(this, ...args));
            else this.client.on(event.name, (...args) => event.execute(this, ...args));
        }

        this.client.login(this.config.token);
    }
};

bot.init();
