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

        //TODO: Handle large amounts of players (don't think it will matter for now)
        // Manually changing headers is a bit of a hack, should change EmbedManager directly
        // Will do when I feel like it
        let reply = (tbl: any[], header: string) => {
            const eb = new EmbedManager("Season Leaderboard", event.client);
            for (let i=0;i<tbl.length;i++) {
                tbl[i].Rank = i + 1;
                const rankObject = {"Rank": null};
                //trustttt
                tbl[i] = Object.assign(rankObject, tbl[i])
            }

            // map doesn't work for some reason
            // tbl.forEach((obj, index) => {
            //     obj.Rank = index + 1;
            // })
            // tbl.map((obj) => {
            //     const rankObject = {"Rank": null};
            //     return Object.assign(rankObject, obj);
            // })

            eb.addObjectArrayToField(tbl)
            if (eb.data.fields) {
                eb.data.fields[1].name = "Player";
                eb.data.fields[2].name = header;
            }
            event.reply({ embeds: [eb] });
        };

        if (args.length === 0) {
            reply(await RiichiDatabase.getLBScore(1000), "Score (Adjusted)");
        }

        if (args[0] === 'init') {
            RiichiDatabase.init();
        } else if (args[0] === 'insert') {
            // await RiichiDatabase.insertData(event.id, parseScoreFromRaw(args.slice(1)));
        } else if (args[0] === 'list') {
            let amount = 10;
            if (args.length >= 2 || !Number.isNaN(args[2])) {
                amount = Number(args[2]);
            }
            if (args[1] === 'rank_average' || args[1] === 'ra') {
                reply(await RiichiDatabase.getLBAveragePlacement(amount), "Average Rank");
            } else if (args[1] === 'score_adj_total' || args[1] === 'sat') {
                reply(await RiichiDatabase.getLBScore(amount), "Score (Adjusted)");
            } else if (args[1] === 'score_raw_total' || args[1] === 'srt') {
                reply(await RiichiDatabase.getLBScoreRaw(amount), "Score (Raw)");
            } else if (args[1] === 'score_adj_average' || args[1] === 'saa') {
                reply(await RiichiDatabase.getLBAverageScore(amount), "Score (Adjusted Average)");
            } else if (args[1] === 'score_raw_average' || args[1] === 'sra') {
                reply(await RiichiDatabase.getLBAverageScoreRaw(amount), "Score (Raw Average)");
            } else if (args[1] === 'game_total' || args[1] === 'gt') {
                reply(await RiichiDatabase.getLBGamesPlayed(amount), "Games Played (Total)");
            } else if (args[1] === 'game_recent' || args[1] === 'gr') {
                reply(await RiichiDatabase.getLBRecentGames(amount), "Recent Games Played");
            }
        } else if (args[0] === 'get') {
            const id = args[2].replace(/<@|>/g, "")
            // check if provided id is comprised of numbers
            if (!/^\d+$/.test(id)) {
                throw Error("invalid player/game id");
            }

            //TODO: Extend player & game commands (never used tho)
            if (args[1] === 'player') {
                reply(await RiichiDatabase.getPlayerProfile(id), "score_adj_total");
            } else if (args[1] === 'game') {
                reply(await RiichiDatabase.getGameProfile(id), "Date");
            }
        } else if (args[0] === 'csv') {
            const data = await RiichiDatabase.getEntireDB();
            // gpt code 
            const gamedata = new AttachmentBuilder(Buffer.from(parse(data[0]), 'utf-8')).setName("DataGame.csv");
            const playerdata = new AttachmentBuilder(Buffer.from(parse(data[1]), 'utf-8')).setName("DataPlayer.csv");
            event.reply({ files: [playerdata, gamedata] });
        }
    }






}


