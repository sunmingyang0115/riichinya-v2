import { Message } from "discord.js";
import { BotModule } from "../data/bot_module";
import { BotRegistrar } from "../data/bot_registrar";
import { BotConfig } from "../data/bot_config";

export class PingModule implements BotModule {
    
    async init(ctx: BotRegistrar) {
        ctx.addMessageCommand('ping', this.onCommandMessage.bind(this));
    }

    async onCommandMessage(conf: BotConfig, event: Message, args: string[]): Promise<void> {
        if (args.length == 0) {
            await event.reply("pong");
        } else {
            await event.reply(args.join(" "));
        }
    }
    
}