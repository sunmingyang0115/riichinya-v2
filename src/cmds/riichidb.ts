import { Message } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder } from "../data/doc_manager";
import { RiichiDatabase } from "./db/sqldb";

export class RiichiDbCommand implements CommandBuilder {
    getDocumentation(): string {
        return new DocBuilder().build();
    }
    getCommandName(): string {
        return "rdb"
    }
    getCooldown(): number {
        return 10;
    }
    runCommand(event: Message<boolean>, args: string[]): void {
        if (event.author.username != "iamthesenate_69") return;

        if (args[0] == 'init') {
            RiichiDatabase.init();
        } else if (args[0] == 'insert') {
            RiichiDatabase.insertData(event.id, [{id:args[1], score:123}, {id:args[2], score:123}, {id:args[3], score:123}, {id:args[4], score:123}])
        }
        
    }

}