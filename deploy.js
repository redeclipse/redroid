const fs = require('fs');
const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');

// Commands read from the source modules when building their config (e.g. dict choices)
global.log = { out: console.log, warn: console.warn, error: console.error, debug: console.log };

// Load source files without starting them
const srcfiles = fs.readdirSync('./src').filter(file => file.endsWith('.js'));
for (const file of srcfiles) {
    console.log(`Loading source: ${file}`);
    const name = file.slice(0, -3);
    global[name] = require(`./src/${file}`);
}

const commands = [];
const commandfiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandfiles) {
    console.log(`Loading command: ${file}`);
    const command = require(`./commands/${file}`);
    if (command.config) {
        if (command.config.chat) commands.push(command.config.chat);
        if (command.config.user) commands.push(command.config.user);
        if (command.config.mesg) commands.push(command.config.mesg);
    }
    else { console.error(`Command provides no config: ${file}`); }
}

const rest = new REST().setToken(token);

(async () => {
    try {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log(`Successfully registered ${commands.length} application commands.`);
    }
    catch (error) {
        console.error(error);
        process.exitCode = 1;
    }
})();
