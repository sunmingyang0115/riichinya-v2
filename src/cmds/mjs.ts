import { Message } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder, ExpectedType } from "../data/doc_manager";
import { EmbedManager } from "../data/embed_manager";
import { linkHandler } from "./mjs/cmd_link";
import { statsHandler } from "./mjs/cmd_stats";

export class MjsCommand implements CommandBuilder {
    getDocumentation(): string {
        return new DocBuilder()
            .addSingleSubCom("ron", ExpectedType.LITERAL, "")
            .addSingleSubCom("mjs", ExpectedType.LITERAL, "")
            .addSingleSubCom(
                "link",
                ExpectedType.LITERAL,
                "Provide no additional arguments to get currently linked MJS user."
            )
            .addSingleSubCom(
                "user_nick",
                ExpectedType.TEXT,
                "Link provided Mahjong Soul username to your account."
            )
            .back()
            .back()
            .addSingleSubCom(
                "stats",
                ExpectedType.LITERAL,
                "Get your Mahjong Soul stats."
            )
            .addSingleSubCom(
                "user_nick",
                ExpectedType.TEXT,
                "Get Mahjong Soul stats for given username."
            )
            .build();
    }
    getCommandName(): string {
        return "mjs";
    }
    getCooldown(): number {
        return 0;
    }
    async runCommand(event: Message<boolean>, args: string[]) {
        const reply = (text: string) => {
            let eb = new EmbedManager(this.getCommandName(), event.client);
            eb.addContent(text);
            event.reply({ embeds: [eb] });
        };
        
        const subcommands: {[command: string]: {handler: (event: Message<boolean>, args: string[]) => Promise<string>}} = { "link": {
                handler: linkHandler
            },
            "stats": {
                handler: statsHandler
            }
        } 

        const content = Object.keys(subcommands).includes(args[0]) ?
            await subcommands[args[0]].handler(event, args.slice(1)) : "Command not found";
        
        reply(content);
    }
}
