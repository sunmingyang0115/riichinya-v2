import 'dotenv/config';
import { Bot } from './data/bot';
import { REST, Routes, ContextMenuCommandBuilder, ApplicationCommandType } from 'discord.js';
import BotProperties from '../bot_properties.json'

const riichinya = new Bot(process.env.TOKEN);
restShenanigans();
riichinya.run();

async function restShenanigans() {
    const commandData = [
        new ContextMenuCommandBuilder()
        .setName('Insert Scores')
        .setType(ApplicationCommandType.Message)
    ];
    console.log('Started refreshing application (/) commands.');
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);
    for (let guildid of BotProperties.activeGuilds) {
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildid),
            { body : commandData },
        );
        console.log(`Successfully reloaded application commands for guild ${guildid}.`);
    }
};