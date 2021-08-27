const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId, token } = require('./config.json');

// Load source files and start them
const srcfiles = fs.readdirSync('./src').filter(file => file.endsWith('.js'));
for (const file of srcfiles) {
    console.log(`Loading source: ${file}`);
    const name = file.slice(0, -3);
    global[name] = require(`./src/${file}`);
}

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    console.log(`Loading command: ${file}`);
    const command = require(`./commands/${file}`);
    if (command.config) {
        if (command.config.chat) commands.push(command.config.chat);
        if (command.config.user) commands.push(command.config.user);
        if (command.config.mesg) commands.push(command.config.mesg);
    }
    else { console.error('ERROR: Command provides no config.'); }
}

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );
        console.log('Successfully registered application commands.');
    }
    catch (error) {
        console.error(error);
    }
})();
