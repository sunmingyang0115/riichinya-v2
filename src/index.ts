import 'dotenv/config';
import { Bot } from './data/bot';
import { REST, Routes, ContextMenuCommandBuilder, ApplicationCommandType } from 'discord.js';
import BotProperties from '../bot_properties.json'
import assert from 'assert';


assert(process.env.TOKEN != undefined, "add TOKEN=<the bot token> in .env");
assert(process.env.CLIENT_ID != undefined, "add CLIENT_ID=<the bot client id> in .env");
assert(BotProperties.activeGuilds != undefined, "add activeGuilds = ['guildid1', ...] field in bot_properties (used for loading interactions to appropriate)");
assert(BotProperties.writeAccess != undefined, "add writeAccess = ['userid1', ...] field in bot_properties (used for gatekeeping write permission in db)");
assert(BotProperties.prefix != undefined, "add prefix = <bot prefix> field in bot_properties");
assert(BotProperties.helpPrefix != undefined, "add helpPrefix = <bot help prefix> field in bot_properties");

const riichinya = new Bot(process.env.TOKEN);
restShenanigans();
riichinya.run();

// error handling
// i tryed try/catching with await; it catches the error, but js still crashes
// this is the only option that worked for me that doesnt end in a crash
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Error', error);
});

async function restShenanigans() {
    const commandData = [
        new ContextMenuCommandBuilder()
        .setName('Insert Scores')
        .setType(ApplicationCommandType.Message)
    ];
    console.log('Started refreshing application (/) commands.');
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);
    for (let guildid of BotProperties.activeGuilds) {
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildid),
            { body : commandData },
        );
        console.log(`Successfully reloaded application commands for guild ${guildid}.`);
    }
};