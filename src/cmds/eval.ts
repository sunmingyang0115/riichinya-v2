import { Message } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { parseArithmetic } from "./eval/parser";
import { Documentation } from "../data/doc_manager";

export class EvalCommand implements CommandBuilder {
    getDocumentation(): Documentation {
        return new Documentation("eval", "LITERAL", "calculates mathematical expression; supports basic binary arithmetic, trig functions, and natural log",
            new Documentation("equation", "STRING", "the provided equation to be evaluated")
        );
    }
    getCommandName(): string {
        return "eval";
    }
    getCooldown(): number {
        return 0;
    }
    async runCommand(event: Message<boolean>, args: string[]) {
        let raw = args.join(' ');
        let ast = parseArithmetic(raw);
        await event.reply("`" + raw + "` => `" + ast + "`");
    }
    
}