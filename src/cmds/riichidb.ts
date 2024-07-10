import { Message, EmbedBuilder, Client } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder } from "../data/doc_manager";
import { RiichiDatabase } from "./riichidb/sql_db";
import { parseScoreFromRaw } from "./riichidb/score_parser";
import { EmbedManager } from "../data/embed_manager";

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
        let a : Client = event.client;

        if (event.author.username != "iamthesenate_69") return;

        let reply = (tbl : object[]) => {
            let eb = new EmbedManager(this.getCommandName(), event.client);
            eb.addObjectArrayToField(tbl)
            event.reply({embeds: [eb]});
        };

        if (args[0] == 'init') {
            RiichiDatabase.init();
        } else if (args[0] == 'insert') {
            RiichiDatabase.insertData(event.id, parseScoreFromRaw(args.slice(1)))
        } else if (args[0] == 'lb') {
            // let reply = (res : object[]) => event.reply(JSON.stringify(res));
            let amount = Number(args[2]);
            if (Number.isNaN(amount)) amount = 10;
            if (args[1] == 'avg_rank') {
                RiichiDatabase.getLBAveragePlacement(amount, reply);
            } else if (args[1] == 'total_score') {
                RiichiDatabase.getLBScore(amount, reply);
            } else if (args[1] == 'avg_score') {
                RiichiDatabase.getLBAverageScore(amount, reply);
            } else if (args[1] == 'games_played') {
                RiichiDatabase.getLBGamesPlayed(amount, reply);
            } else if (args[1] == 'recent_games') {
                RiichiDatabase.getLBRecentGames(amount, reply);
            }
        } else if (args[0] == 'id') {
            let id = args[2];
            // console.log(id);
            if (args[1] == 'player') {
                RiichiDatabase.getPlayerProfile(id, reply);
            } else if (args[1] == 'game') {
                RiichiDatabase.getGameProfile(id, reply);
            }
        } 
    }


    



}


