import { Message } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder, ExpectedType } from "../data/doc_manager";

export class TestCommand implements CommandBuilder {
    getCommandName(): string {
        return "test"
    }
    getCooldown(): number {
        return 0;
    }
    getDocumentation(): string {
        return new DocBuilder()
        .addSingleSubCom("ron", ExpectedType.LITERAL,"")
        .addSingleSubCom("test", ExpectedType.LITERAL, "")
        .beginMultiSubCom("arg1")
        .insertMultiSubCom(ExpectedType.INTEGER, "")
        .addSingleSubCom("arg2_numbers", ExpectedType.INTEGER, "")
        .addSingleSubCom("arg3_empty", ExpectedType.EMPTY, "will add these numbers together")
        .back()
        .back()
        .insertMultiSubCom(ExpectedType.TEXT, "")
        .addSingleSubCom("arg2_colours", ExpectedType.TEXT, "")
        .addSingleSubCom("arg3_colours", ExpectedType.TEXT, "")
        .addSingleSubCom("arg4_colours", ExpectedType.EMPTY, "pick correct color combination to win")
        .addExampleDoc("ron test thisisatest", "incorrect arguments", "no hints")
        .build();
    }
    runCommand(event: Message<boolean>, args: string[]): void {
        if (args.length == 2) {
            let a0 = parseInt(args[0]);
            if (!Number.isNaN(a0)) {
                let a1 = parseInt(args[1]);
                if (!Number.isNaN(a1)) {
                    event.reply(`${a0} + ${a1} = ${a0 + a1}`);
                } else {
                    let a1cut = args[1].length>2?args[1].substring(0,2):"";
                    event.reply(`${a0} + ${a1cut}.. huh? you can't add these together!`);
                }
            } else {
                event.reply(`what is ${a0}?`);
            }
        } else if (args.length == 3) {
            let opt = ["red", "green", "blue"];
            if (args[0] == "red") {
                event.reply("bad choice; try again")
            } else if (args[0] == "green") {
                event.reply("bad choice; try again")
            } else if (args[0] == "blue") {
                if (args[1] == "red") {
                    event.reply("bad choice; try again")
                } else if (args[1] == "green") {
                    if (args[2] == "red") {
                        event.reply("you win the puzzle")
                    } else {
                        event.reply("3 options: red green or blue")
                    }
                } else {
                    event.reply("3 options: red green or blue")
                }
            } else {
                event.reply("3 options: red green or blue")
            }
        } else {
            event.reply("incorrect arguments");
        }
    }
    
}