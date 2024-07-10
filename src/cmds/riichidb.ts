import { Message, Client, AttachmentBuilder } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder } from "../data/doc_manager";
import { RiichiDatabase } from "./riichidb/sql_db";
import { parseScoreFromRaw } from "./riichidb/score_parser";
import { EmbedManager } from "../data/embed_manager";
import { parse } from "json2csv";

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
    async runCommand(event: Message<boolean>, args: string[]): Promise<void> {
        let a : Client = event.client;

        let reply = (tbl : object[]) => {
            console.log(tbl);
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
                reply(await RiichiDatabase.getLBAveragePlacement(amount));
            } else if (args[1] == 'total_score') {
                reply(await RiichiDatabase.getLBScore(amount));
            } else if (args[1] == 'avg_score') {
                reply(await RiichiDatabase.getLBAverageScore(amount));
            } else if (args[1] == 'games_played') {
                reply(await RiichiDatabase.getLBGamesPlayed(amount));
            } else if (args[1] == 'recent_games') {
                reply(await RiichiDatabase.getLBRecentGames(amount));
            }
        } else if (args[0] == 'id') {
            let id = args[2];
            // console.log(id);
            if (args[1] == 'player') {
                reply(await RiichiDatabase.getPlayerProfile(id));
            } else if (args[1] == 'game') {
                reply(await RiichiDatabase.getGameProfile(id));
            }
        } else if (args[0] == 'csv') {
            let data = await RiichiDatabase.getEntireDB();
            // gpt code 
            const gamedata = new AttachmentBuilder(Buffer.from(parse(data[0]), 'utf-8')).setName("gamedata.csv");
            const playerdata = new AttachmentBuilder(Buffer.from(parse(data[1]), 'utf-8')).setName("playerdata.csv");
            event.reply({files : [playerdata, gamedata]});
        }
    }


    



}


