import { Message, Client, AttachmentBuilder } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder, ExpectedType } from "../data/doc_manager";
import { RiichiDatabase } from "./riichidb/sql_db";
import { parseScoreFromRaw } from "./riichidb/score_parser";
import { EmbedManager } from "../data/embed_manager";
import { parse } from "json2csv";

export class RiichiDbCommand implements CommandBuilder {
    getDocumentation(): string {
        return new DocBuilder()
            .addSingleSubCom("ron", ExpectedType.LITERAL, "")
            .addSingleSubCom("rdb", ExpectedType.LITERAL, "")
            .beginMultiSubCom("list")
            .insertMultiSubCom(ExpectedType.LITERAL, "lists rows of data based on folllowing subcategories")

            .beginMultiSubCom("ra")
            .insertMultiSubCom(ExpectedType.LITERAL, "by rank average")
            .back()

            .beginMultiSubCom("sat")
            .insertMultiSubCom(ExpectedType.LITERAL, "by score (adjusted) as total")
            .back()

            .beginMultiSubCom("srt")
            .insertMultiSubCom(ExpectedType.LITERAL, "by score (raw) as total")
            .back()

            .beginMultiSubCom("saa")
            .insertMultiSubCom(ExpectedType.LITERAL, "by score (adjusted) as average")
            .back()

            .beginMultiSubCom("sra")
            .insertMultiSubCom(ExpectedType.LITERAL, "by score (raw) as average")
            .back()

            .beginMultiSubCom("gt")
            .insertMultiSubCom(ExpectedType.LITERAL, "by games played as total")
            .back()

            .beginMultiSubCom("gr")
            .insertMultiSubCom(ExpectedType.LITERAL, "by recent games1")
            .back()

            .back()

            .beginMultiSubCom("get")
            .insertMultiSubCom(ExpectedType.LITERAL, "fetches a single data based on following subcategories")

            .beginMultiSubCom("player")
            .insertMultiSubCom(ExpectedType.LITERAL, "getting player data")
            .addSingleSubCom("id", ExpectedType.DECIMAL, "id of player")
            .back()
            .back()

            .beginMultiSubCom("game")
            .insertMultiSubCom(ExpectedType.LITERAL, "getting game data")
            .addSingleSubCom("id", ExpectedType.DECIMAL, "id of game")
            .back()



            .back()

            .beginMultiSubCom("csv")
            .insertMultiSubCom(ExpectedType.LITERAL, "")
            .back()
            .build();
    }
    getCommandName(): string {
        return "rdb"
    }
    getCooldown(): number {
        return 10;
    }
    async runCommand(event: Message<boolean>, args: string[]): Promise<void> {
        let a: Client = event.client;

        let reply = (tbl: object[]) => {
            // console.log(tbl);
            let eb = new EmbedManager(this.getCommandName(), event.client);
            eb.addObjectArrayToField(tbl)
            event.reply({ embeds: [eb] });
        };

        if (args.length == 0) {
            //official leaderboard (just ron rdb sat 1000)
            let eb = new EmbedManager("Season Leaderboard", event.client);
            let objectArray = await RiichiDatabase.getLBScore(1000) as any[];
            //manually adding a field for rank

            for (let i=0;i<objectArray.length;i++) {
                objectArray[i].Rank = i + 1;
                let rankObject = {"Rank": null};
                //trustttt
                objectArray[i] = Object.assign(rankObject, objectArray[i])
            }
            eb.addObjectArrayToField(objectArray);
            console.log(eb.data.fields);
            //manually changing field names lolol
            if (eb.data.fields) {
                eb.data.fields[1].name = "Player";
                eb.data.fields[2].name = "Score (adjusted)";
            }
            
            event.reply({ embeds: [eb] });
            return;
        }

        if (args[0] == 'init') {
            RiichiDatabase.init();
        } else if (args[0] == 'insert') {
            // await RiichiDatabase.insertData(event.id, parseScoreFromRaw(args.slice(1)));
        } else if (args[0] == 'list') {
            // let reply = (res : object[]) => event.reply(JSON.stringify(res));
            let amount = Number(args[2]);
            if (Number.isNaN(amount)) amount = 10;
            if (args[1] == 'rank_average' || args[1] == 'ra') {
                reply(await RiichiDatabase.getLBAveragePlacement(amount));
            } else if (args[1] == 'score_adj_total' || args[1] == 'sat') {
                reply(await RiichiDatabase.getLBScore(amount));
            } else if (args[1] == 'score_raw_total' || args[1] == 'srt') {
                reply(await RiichiDatabase.getLBScoreRaw(amount));
            } else if (args[1] == 'score_adj_average' || args[1] == 'saa') {
                reply(await RiichiDatabase.getLBAverageScore(amount));
            } else if (args[1] == 'score_raw_average' || args[1] == 'sra') {
                reply(await RiichiDatabase.getLBAverageScoreRaw(amount));
            } else if (args[1] == 'game_total' || args[1] == 'gt') {
                reply(await RiichiDatabase.getLBGamesPlayed(amount));
            } else if (args[1] == 'game_recent' || args[1] == 'gr') {
                reply(await RiichiDatabase.getLBRecentGames(amount));
            }
        } else if (args[0] == 'get') {
            let id = args[2];
            // check if provided id is comprised of numbers
            if (!/^\d+$/.test(id)) {
                throw Error("invalid player/game id");
            }
            if (args[1] == 'player') {
                reply(await RiichiDatabase.getPlayerProfile(id));
            } else if (args[1] == 'game') {
                reply(await RiichiDatabase.getGameProfile(id));
            }
        } else if (args[0] == 'csv') {
            let data = await RiichiDatabase.getEntireDB();
            // gpt code 
            const gamedata = new AttachmentBuilder(Buffer.from(parse(data[0]), 'utf-8')).setName("DataGame.csv");
            const playerdata = new AttachmentBuilder(Buffer.from(parse(data[1]), 'utf-8')).setName("DataPlayer.csv");
            event.reply({ files: [playerdata, gamedata] });
        }
    }






}


