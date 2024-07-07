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
            RiichiDatabase.insertData(event.id, this.parser(args.slice(1)))
        }
        
    }

    private parser(args : string[]) : {id : string, score : number}[] {
        let parsed : {id : string, score : number}[] = [];
        for (let i = 0; i < args.length; i+=2) {
            parsed.push({id: args[i], score: Number(args[i+1])});
        }
        this.formatScores(parsed);
        this.adjustScoreAndSort(parsed);
        return parsed;
    }

    private formatScores(parsed : {id : string, score : number}[]) : {id : string, score : number}[]{
        let sum = parsed.reduce((acc, cur) => acc + cur.score, 0);
        if (sum <= 100) {    // 48.0 2.0 25.0 25.0
            parsed.map((e, i) => parsed[i].score = Math.round(1000*e.score));
        }else {             // 48000 2000 25000 25000
            parsed.map((e, i) => parsed[i].score = Math.round(e.score));
        }
        return parsed;
        // 480 20 250 250
    }

    private adjustScoreAndSort(parsed : {id : string, score : number}[]) {
        parsed.sort((a, b) => b.score - a.score);
        let uma = [15000, 5000, -5000, -15000];
        console.log(parsed);
        parsed.map((e, i) => parsed[i].score += uma[i]);
        console.log(parsed);
        return parsed;
    }

}


