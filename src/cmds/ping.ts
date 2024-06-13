import { Message } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { Documentation } from "../data/doc_manager";

export class PingCommand implements CommandBuilder {
    getDocumentation(): Documentation {
        return new Documentation("ping", "LITERAL", "replies when called; used for checking bot latency",
            new Documentation("ping-args", "STRING", "replies with provided [ping-args]"),
            new Documentation("ping-args", "VOID", "replies with 'pong'")
        );  
    }
    getCommandName(): string {
        return "ping";
    }
    getCooldown(): number {
        return 0;
    }
    async runCommand(event: Message<boolean>, args: string[]) {
        if (args.length == 0) {
            await event.reply("pong");
        } else {
            await event.reply(args.join(" "));
        }
    }
    
}