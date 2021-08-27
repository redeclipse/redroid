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
    if (typeof command.config.chat !== 'undefined') commands.push(command.config.chat);
    if (typeof command.config.user !== 'undefined') commands.push(command.config.user);
    if (typeof command.config.mesg !== 'undefined') commands.push(command.config.mesg);
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
