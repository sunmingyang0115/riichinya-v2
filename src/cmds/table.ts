import { EmbedBuilder, Message } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder, ExpectedType } from "../data/doc_manager";
import { TableHeader, tableCreator } from "../templates/table";
export class TableCommand implements CommandBuilder {

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
        return "table";
    }
    getCooldown(): number {
        return 0;
    }
    async runCommand(event: Message<boolean>, args: string[]) {
        let rows = [["1","<@576031405037977600>","5"]]
        let headers: TableHeader[] = [
            {key: "rank", title: "Rank", sortFunc: (a,b) => a - b},
            {key: "user", title: "User", sortFunc: (a,b) => a - b},
            {key: "score", title: "Total Score", sortFunc: (a,b) => a -b}
        ]
        const embed = tableCreator(new EmbedBuilder(),[],rows,headers)
        event.reply({embeds: [embed]})
        
    }
    
}