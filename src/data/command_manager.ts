import { Message } from "discord.js"

export interface CommandBuilder {
    getCommandName() : string;
    getCooldown() : number;
    runCommand(event : Message, args : string[]) : void;
}