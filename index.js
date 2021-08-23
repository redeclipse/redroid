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

    // Initialise stuff
    init() {
        this.client.commands = new Collection();
        const commandfiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
        for (const file of commandfiles) {
            const command = require(`./commands/${file}`);
            this.client.commands.set(command.data.name, command);
        }

        const eventfiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
        for (const file of eventfiles) {
            const event = require(`./events/${file}`);
            if (event.once) {
                this.client.once(event.name, (...args) => event.execute(this, ...args));
            }
            else {
                this.client.on(event.name, (...args) => event.execute(this, ...args));
            }
        }

        this.client.login(this.config.token);
    },

    // Returns an access level for a guild user
    level(guild, user) {
        const member = guild.members.resolve(user);
        switch (guild.id) {
            case '224638962050793474': {
                // Red Eclipse
                if (member.id === '189189124194959361' || member.id === '854993935831138323') return 10;
                if (member.roles.cache.find(r => r.name === 'Developers')) return 6;
                if (member.roles.cache.find(r => r.name === 'Administrators')) return 5;
                if (member.roles.cache.find(r => r.name === 'Moderators')) return 4;
                if (member.roles.cache.find(r => r.name === 'Supporters')) return 3;
                if (member.roles.cache.find(r => r.name === 'Speshul')) return 2;
                if (member.roles.cache.find(r => r.name === 'Team Alpha') || member.roles.cache.find(r => r.name === 'Team Omega')) return 1;
                break;
            }
            default: break;
        }
        return 0;
    }
};

bot.init();
