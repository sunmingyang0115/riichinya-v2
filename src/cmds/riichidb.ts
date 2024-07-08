import { Message } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder } from "../data/doc_manager";
import { RiichiDatabase } from "./db/sql_db";
import { SQLMap } from "./db/sql_map";

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
        } else if (args[0] == 'lb') {
            let reply = (res : {id: number; value: number}[]) => event.reply(JSON.stringify(res));
            let amount = Number(args[2]);
            if (args[1] == 'avg_rank') {
                RiichiDatabase.getLBAveragePlacement(amount, reply);
            } else if (args[1] == 'score') {
                RiichiDatabase.getLBScore(amount, reply);
            } else if (args[1] == 'avg_score') {
                RiichiDatabase.getLBAverageScore(amount, reply);
            } else if (args[1] == 'games_played') {
                RiichiDatabase.getLBGamesPlayed(amount, reply);
            }
        }
    }

    /**
     * parses raw spliced strings of user ids and scores into a sorted SQLMap
     * @param args takes a string array in the format of [id1 value1 id2 ... id4 value4], with all fields representable as numbers
     * @returns SQLMap in the form [{id1, adjvalue1}, ... {id4, adjvalue4}] sorted by DESC adjvalue
     * 
     * @see adjustScoreAndSort for uma adjustment
     * @see formatScores for score formatting (17.3 -> 17000)
     */
    private parser(args : string[]) : SQLMap {
        let parsed : SQLMap = [];
        for (let i = 0; i < args.length; i+=2) {
            parsed.push({id: Number(args[i]), value: Number(args[i+1])});
        }
        this.formatScores(parsed);
        this.adjustScoreAndSort(parsed);
        return parsed;
    }

    /**
     * formats scores into 'thousand' notation (mangan is 8000 not 8.0)
     * if score is represented as 'decimal' notation, will be converted to 'thousand' (8.0 => 8000)
     * @param parsed unadjusted SQLMap with unformatted scores @see parser 
     * @returns SQLMap with unsorted and formatted scores with no uma @see adjustScoreAndSort
     */
    private formatScores(parsed : SQLMap) : SQLMap {
        let sum = parsed.reduce((acc, cur) => acc + cur.value, 0);
        if (sum <= 100) {    // 48.0 2.0 25.0 25.0
            parsed.map((e, i) => parsed[i].value = Math.round(1000*e.value));
        }else {             // 48000 2000 25000 25000
            parsed.map((e, i) => parsed[i].value = Math.round(e.value));
        }
        return parsed;
        // 480 20 250 250
    }

    /**
     * does end score adjustment * 1000 (we do this to mitigate fp-errors)
     * adjustment calculation:
     *      End score = End points - Starting + 1000 * Uma
     * @param parsed the SQLMap with unadjusted and formatted scores @see formatScores
     * @returns SQLMap that is adjusted and formatted
     */
    private adjustScoreAndSort(parsed : SQLMap) {
        parsed.sort((a, b) => b.value - a.value);
        let starting_score = 25000;
        let uma = [15, 5, -5, -15];
        console.log(parsed);
        parsed.map((e, i) => parsed[i].value = e.value + 1000 * uma[i] + starting_score);
        console.log(parsed);
        return parsed;
    }

}


