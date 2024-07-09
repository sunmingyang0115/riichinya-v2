import { Message, EmbedBuilder } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder } from "../data/doc_manager";
import { GameInfo, RiichiDatabase } from "./riichidb/sql_db";
import { parseScoreFromRaw } from "./riichidb/score_parser";
import { copyFileSync } from "fs";

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

        let reply = (tbl : object[]) => {
            let eb = new EmbedBuilder();
            this.addObjectArrayToField(eb, tbl)
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
        } else if (args[0] == 'test') {
            RiichiDatabase.getLBRecentGames(10, (tbl : object[]) => {
                let eb = new EmbedBuilder();
                this.addObjectArrayToField(eb, tbl)
                event.reply({embeds: [eb]});
            });
        }
    }


    private addObjectArrayToField(eb : EmbedBuilder, ob : object[]) : EmbedBuilder {
        if (ob.length == 0) return eb;

        let labels = Object.keys(ob[0]);
        let cols = Object.values(ob[0]).length;

        for (var col = 0; col < cols; col++) {
            let label = Object.keys(ob[0])[col];
            let out : any[] = [];
            for (var row = 0; row < ob.length; row++) {
                out.push(this.format(Object.values(ob[row])[col], label));
            }
            // console.log(out)
            eb.addFields({name: label, value : out.join('\n'), inline: true});
        }
        return eb;
    }

    private format(t : object, label : string) : any {
        if (label.startsWith("player_id")) {
            console.log(`<@${t}>`)  
            return `<@${t}>`;
        } else if (label.startsWith("date")) {
            let date = new Date(Number(`${t}`));
            let year = date.getFullYear();
            let month = String(date.getMonth() + 1).padStart(2, '0');
            let day = String(date.getDate()).padStart(2, '0');
            let hours = String(date.getHours()).padStart(2, '0');
            let minutes = String(date.getMinutes()).padStart(2, '0');
            let seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        }
        return t;
    } 



}


