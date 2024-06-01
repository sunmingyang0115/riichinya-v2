import 'dotenv/config';
import {Client} from 'discord.js';

const client = new Client ({
    intents : ['Guilds', 'GuildMessages', 'MessageContent']
});

client.on('ready', (c) => {
    console.log("test");
})

client.login(process.env.TOKEN);