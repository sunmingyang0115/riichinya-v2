import { Message } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder, ExpectedType } from "../data/doc_manager";

export class PingCommand implements CommandBuilder {

    getDocumentation(): string {
        return new DocBuilder()
        .addSingleSubCom("ron", ExpectedType.LITERAL, "")
        .addSingleSubCom("ping", ExpectedType.LITERAL, "")
        .beginMultiSubCom("ping-args")
            .insertMultiSubCom(ExpectedType.TEXT, "replies with provided [ping-args]")
            .insertMultiSubCom(ExpectedType.EMPTY, "replies with 'pong'")
        .addExampleDoc("ron ping", "pong", "matches EMPTY type for ping-args")
        .addExampleDoc("ron ping test 123", "test 123", "likewise matches TEXT argument")
        .build();
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