import { Message } from "discord.js";
import { CommandBuilder } from "../data/command_manager";
import { parseArithmetic } from "./eval/parser";

export class EvalCommand implements CommandBuilder {
    getCommandName(): string {
        return "eval";
    }
    getCooldown(): number {
        return 0;
    }
    async runCommand(event: Message<boolean>, args: string[]) {
        let raw = args.join(' ');
        let ast = parseArithmetic(raw);
        await event.reply(raw + " => " + ast?.toString() + " => " + ast?.interp());
    }
    
}