import { Message } from "discord.js";
import { CommandBuilder } from "../data/command_manager";

export class PingCommand implements CommandBuilder {
    getCommandName(): string {
        return "ping";
    }
    getCooldown(): number {
        return 0;
    }
    async runCommand(event: Message<boolean>, args: string[]) {
        await event.reply("pong " + args);
    }
    
}