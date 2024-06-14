import { Message } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { parseArithmetic } from "./eval/parser";
import { DocBuilder, ExpectedType } from "../data/doc_manager";

export class EvalCommand implements CommandBuilder {
    getDocumentation(): string {
        return new DocBuilder()
        .addSingleSubCom("ron", ExpectedType.LITERAL, "")
        .addSingleSubCom("eval", ExpectedType.LITERAL, "")
        .addSingleSubCom("eval-args", ExpectedType.TEXT, "the mathematical expression in text to be calculated")
        .addExampleDoc("ron eval 2^3^4", "2^3^4 => 2.4178516392292583e+24", "left associativity of exponents")
        .addExampleDoc("ron eval 2 - 3 - 4", "2 - 3 - 4 => -5", "right associativity of common binary operators")
        .addExampleDoc("ron eval log(e^pi)", "log(e^pi) => 3.141592653589793", "supports these constants and log")
        .addExampleDoc("ron eval tanpi", "tanpi => -1.2246467991473532e-16", "support common trig operators")
        .addExampleDoc("ron eval banana", "banana => null", "invalid expression")
        .build();
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