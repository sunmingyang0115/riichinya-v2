import { Message } from "discord.js"
import { Documentation } from "./doc_manager";

/**
 * This interface is used to create commands.
 * Commands are response from the bot when a command name is referenced.
 * 
 * constructor() -> called when a new Bot instance is created
 * getCommandName() -> the name of the command; when the name is called by the user, it will trigger runCommand
 * getDocumentation() -> documentation of the command; viewed by running the help command
 * runCommand() -> the response from the bot when command is called
 */
export interface CommandBuilder {
    getCommandName() : string;
    getCooldown() : number;
    getDocumentation() : Documentation;
    runCommand(event : Message, args : string[]) : void;
}

