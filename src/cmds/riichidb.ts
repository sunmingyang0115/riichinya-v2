import { Message, Client, AttachmentBuilder, Collection } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder, ExpectedType } from "../data/doc_manager";
import { DataGameSQLEntry, DataPlayerSQLEntry, playerDataAttr, RiichiDatabase } from "./riichidb/sql_db";
import { parseScoreFromRaw } from "./riichidb/score_parser";
import { EmbedManager, Header } from "../data/embed_manager";
import { parse } from "json2csv";
import { playerProfileCreator } from "../templates/playerProfile";

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

            .beginMultiSubCom("player")
            .insertMultiSubCom(ExpectedType.LITERAL, "getting player data and profile embed")
            .addSingleSubCom("id", ExpectedType.DECIMAL, "id of player")
            .back()
            .back()

            .beginMultiSubCom("game")
            .insertMultiSubCom(ExpectedType.LITERAL, "getting game data")
            .addSingleSubCom("id", ExpectedType.DECIMAL, "id of game")
            .back()

            .back()

            .beginMultiSubCom("me")
            .insertMultiSubCom(ExpectedType.LITERAL, "shows your player profile embed")
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

        //some hardcoded defaults
        if (args.length === 0) {
            args = ["sat"]
        }

        if (args.length === 1 && args[0] === "m") {
            args = ["sat", "m"];
        }

        if (args[0] === 'init') {
            RiichiDatabase.init();
        } else if (args[0] === 'insert') {
            //await RiichiDatabase.insertData(event.id, parseScoreFromRaw(args.slice(1)));
        } else if (args[0] === 'me') {
            // Show the profile of the user who invoked the command
            const [embed, files] = await playerProfileCreator(event.author);
            event.reply({ embeds: [embed], files: files });
        } else if (args[0] === 'player') {
            const id = args[1].replace(/<@|>/g, "")
            // check if provided id is comprised of numbers
            if (!/^\d+$/.test(id)) {
                throw Error("invalid player id");
            }

            // Show the profile of the specified player
            const user = await event.client.users.fetch(id).catch(() => null);
            if (!user) {
                throw Error("User not found");
            }
            const [embed, files] = await playerProfileCreator(user);
            event.reply({ embeds: [embed], files: files });
        } else if (args[0] === 'game') {
            if (!/^\d+$/.test(args[2])) {
                throw Error("invalid player id");
            }
            //reply(await RiichiDatabase.getGameProfile(args[2]), "Date");
        } else if (args[0] === 'games') {
            //unfortunately it seems impossible to show games in a table format
        } else if (args[0] === 'csv') {
            const data = await RiichiDatabase.getEntireDB();
            // gpt code 
            const gamedata = new AttachmentBuilder(Buffer.from(parse(data[0]), 'utf-8')).setName("DataGame.csv");
            const playerdata = new AttachmentBuilder(Buffer.from(parse(data[1]), 'utf-8')).setName("DataPlayer.csv");
            event.reply({ files: [playerdata, gamedata] });
        } else if (args[0] === 'verify') {
            const entire_db = await RiichiDatabase.getEntireDB();
            const gamedata_sqltbl = entire_db[0] as DataGameSQLEntry[];
            const playerdata_sqltbl = entire_db[1] as DataPlayerSQLEntry[];

            const adj_map: Map<string, number> = new Map();
            const raw_map: Map<string, number> = new Map();
            const games_played_map: Map<string, number> = new Map();
            const rank_total_map: Map<string, number> = new Map();

            gamedata_sqltbl.forEach((e) => {
                adj_map.set(e.id_player_1, e.score_adj_1 + (adj_map.get(e.id_player_1) ?? 0));
                adj_map.set(e.id_player_2, e.score_adj_2 + (adj_map.get(e.id_player_2) ?? 0));
                adj_map.set(e.id_player_3, e.score_adj_3 + (adj_map.get(e.id_player_3) ?? 0));
                adj_map.set(e.id_player_4, e.score_adj_4 + (adj_map.get(e.id_player_4) ?? 0));

                raw_map.set(e.id_player_1, e.score_raw_1 + (raw_map.get(e.id_player_1) ?? 0));
                raw_map.set(e.id_player_2, e.score_raw_2 + (raw_map.get(e.id_player_2) ?? 0));
                raw_map.set(e.id_player_3, e.score_raw_3 + (raw_map.get(e.id_player_3) ?? 0));
                raw_map.set(e.id_player_4, e.score_raw_4 + (raw_map.get(e.id_player_4) ?? 0));

                games_played_map.set(e.id_player_1, 1 + (games_played_map.get(e.id_player_1) ?? 0));
                games_played_map.set(e.id_player_2, 1 + (games_played_map.get(e.id_player_2) ?? 0));
                games_played_map.set(e.id_player_3, 1 + (games_played_map.get(e.id_player_3) ?? 0));
                games_played_map.set(e.id_player_4, 1 + (games_played_map.get(e.id_player_4) ?? 0));

                rank_total_map.set(e.id_player_1, 1 + (rank_total_map.get(e.id_player_1) ?? 0));
                rank_total_map.set(e.id_player_2, 2 + (rank_total_map.get(e.id_player_2) ?? 0));
                rank_total_map.set(e.id_player_3, 3 + (rank_total_map.get(e.id_player_3) ?? 0));
                rank_total_map.set(e.id_player_4, 4 + (rank_total_map.get(e.id_player_4) ?? 0));
            });

            let adj_diff = 0;
            let raw_diff = 0;
            let game_total_diff = 0;
            let rank_total_diff = 0;
            playerdata_sqltbl.forEach((e) => {
                adj_diff += adj_map.get(e.id_player) == e.score_adj_total ? 0 : 1;
                raw_diff += raw_map.get(e.id_player) == e.score_raw_total ? 0 : 1;
                game_total_diff += games_played_map.get(e.id_player) == e.game_total ? 0 : 1;
                rank_total_diff += rank_total_map.get(e.id_player) == e.rank_total ? 0 : 1;
            }, true);

            
            await event.reply(`Checked ${gamedata_sqltbl.length} GameData and ${playerdata_sqltbl.length} PlayerData entries. Found ${adj_diff}(adj), ${raw_diff}(raw), ${game_total_diff}(gt), ${rank_total_diff}(rt) discrepancies.` );
            
        } else {
            let amount = 100;
            
            let headers: Header[] = []
            let data = null;
            let mobile = false;

            const acronyms: Record<string, playerDataAttr> = {
                "ra": "rank_average",
                "sat": "score_adj_total",
                "srt": "score_raw_total",
                "saa": "score_adj_average",
                "sra": "score_raw_average",
                "gt": "game_total"
            }

            const headerData: Record<playerDataAttr, Header> = {
                "rank_average": {k: "", l: "Average Rank", t: "number" },
                "score_adj_total": {k: "", l: "Score (Adjusted)", t: "score" },
                "score_raw_total": {k: "", l: "Score (Raw)", t: "score" },
                "score_adj_average": {k: "", l: "Score (Adjusted Average)", t: "score" },
                "score_raw_average": {k: "", l: "Score (Raw Average)", t: "score" },
                "game_total": {k: "", l: "Games Played (Total)", t: "number" },
                "rank_total": {k: "", l: "Rank Total", t: "number" }
            }

            for (let i = 0; i < args.length; i++) {
                if (args[i] === 'm') {
                    mobile = true;
                } else if (!isNaN(Number(args[i])) && Number.isInteger(Number(args[i]))) {
                    amount = Number(args[i]);
                } else if (args[i] in acronyms) {
                    const key = acronyms[args[i]];
                    headers.push({ k: key, l: headerData[key].l, t: headerData[key].t });
                } else if (args[i] in headerData) {
                    const key = args[i] as playerDataAttr;
                    headers.push({ k: key, l: headerData[key].l, t: headerData[key].t });
                }
                data = await RiichiDatabase.getPlayerData(amount, headers.map(h => h.k) as playerDataAttr[]);
            }
            
            if (data) {
                //Add rank and player headers:
                //Idk why it doesn't let me do it in one line
                headers.unshift({k: "id_player", l: "Player", t: "mention"});
                headers.unshift({k: "rank", l: "Rank", t: "string"});
                data.forEach((p,i) => p.rank = `**${i+1}**`);

                const eb = new EmbedManager("Season Leaderboard", event.client);
                if (mobile) {
                    eb.addObjectArrayToMobile(headers, data);
                } else {
                    eb.addObjectArrayToField(headers, data);
                }
                event.reply({ embeds: [eb] });
            }
        }
    }






}


