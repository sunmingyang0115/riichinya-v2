import { EmbedBuilder, Message } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder, ExpectedType } from "../data/doc_manager";
import { TableHeader, tableCreator, sortNumber, sortString } from "../templates/table";
export class TableCommand implements CommandBuilder {

    getDocumentation(): string {
        return new DocBuilder()
            .addSingleSubCom("ron", ExpectedType.LITERAL, "")
            .addSingleSubCom("table", ExpectedType.LITERAL, "displays a formatted table with provided data")
            .addExampleDoc("ron table", "shows a sample table with rank, user, and score columns", "demonstrates the table output")
            .build();
    }
    getCommandName(): string {
        return "table";
    }
    getCooldown(): number {
        return 0;
    }
    async runCommand(event: Message<boolean>, args: string[]) {
        let rows = [["1","<@576031405037977600>","5"],
    ["2","<@12032984348374>","4"]]
        let headers: TableHeader[] = [
            {key: "rank", title: "Rank", sortFunc: sortNumber},
            {key: "user", title: "User", sortFunc: sortString},
            {key: "score", title: "Total Score", sortFunc: sortNumber}
        ]
        const embed = tableCreator(new EmbedBuilder(),[],rows,headers)
        event.reply({embeds: [embed]})
        
    }
    
}