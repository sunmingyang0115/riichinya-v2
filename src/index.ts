import 'dotenv/config';
import { Bot } from './data/bot';
import { REST, Routes, ContextMenuCommandBuilder, ApplicationCommandType } from 'discord.js';

const riichinya = new Bot(process.env.TOKEN);
riichinya.run();



// restShenanigans()

async function restShenanigans() {
    const commandData = [
        new ContextMenuCommandBuilder()
        .setName('Insert Scores')
        .setType(ApplicationCommandType.Message)
    ];
    console.log('Started refreshing application (/) commands.');
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);
    const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
        { body : commandData },
    );
    console.log(`Successfully reloaded ${data} application (/) commands.`);
};