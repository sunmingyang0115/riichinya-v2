import { Client, Message } from "discord.js";
import { parseArithmetic } from "./eval/parser";
import { BotModule } from "../data/bot_module";
import { BotRegistrar } from "../data/bot_registrar";

export class EvalCommand implements BotModule {
    init(ctx: BotRegistrar): void | Promise<void> {
        ctx.addMessageCommand('eval', async (conf, event, args) => {
            let raw = args.join(' ');
            let ast = parseArithmetic(raw);
            await event.reply("`" + raw + "` => `" + ast + "`");
        })
    }
        
}






