import { symlinkSync } from "fs";
import sqlite3, { LIMIT_LIKE_PATTERN_LENGTH } from "sqlite3";
import { SQLMap } from "./sql_map";
sqlite3.verbose()

const db = new sqlite3.Database('rdb.sql');
const date = new Date();

export class RiichiDatabase {
        
    /**
     * EXTERNAL
     * global lb
     *  -> by avg placement
     *  -> by avg/acc adjscore
     *  -> by acc wins
     *  -> by date
     *  -> by times played
     * 
     * user lb
     *  -> by avg/acc adjscore
     *  -> by acc wins
     *  -> by avg placement
     *  -> times played
     */

    /**
     * INTERNAL
     * 
     * GO:
     * gameid, date,
     * playerid (p1,p2,p3,p4),
     * score# (s1,s2,s3,s4)
     * 
     * PO:
     * playerid, score, ranking, played
     */

    static init() {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS gamedata 
                (id             INTEGER NOT NULL UNIQUE, 
                date            INTEGER NOT NULL, 
                player_id1      INTEGER NOT NULL, 
                player_id2      INTEGER NOT NULL, 
                player_id3      INTEGER NOT NULL, 
                player_id4      INTEGER NOT NULL, 
                score1          INTEGER NOT NULL, 
                score2          INTEGER NOT NULL, 
                score3          INTEGER NOT NULL, 
                score4          INTEGER NOT NULL)`);
            db.run(`CREATE TABLE IF NOT EXISTS playerdata 
                (id             INTEGER NOT NULL UNIQUE ,
                scores          INTEGER NOT NULL, 
                ranks           INTEGER NOT NULL, 
                games_played    INTEGER NOT NULL)`);
        })
    }

    static insertData(id : string, data : SQLMap) {
        let stmt : string[] = [];
        let curtime = date.getTime().toString();
        stmt.push(id);
        stmt.push(curtime);
        for (let i = 1; i < 5; i++) {
            let pair = data[i];
            stmt.push(pair.id.toString());
            stmt.push(pair.value.toString());
            db.run(`INSERT INTO playerdata (id, scores, ranks, games_played) VALUES (${pair.id}, ${pair.value}, ${i}, ${1}) 
                ON CONFLICT (id) DO UPDATE SET 
                scores = scores + ${pair.value},
                ranks = ranks + ${i},
                games_played = games_played + ${1}`);
        }
        db.run(`INSERT INTO gamedata (id, date, player_id1, score1, player_id2, score2, player_id3, score3, player_id4, score4) VALUES (${stmt.join(", ")})`);
    }

    static getLBAveragePlacement(n : number, callback : (data : SQLMap) => void) {
        this.queryHelper(`SELECT id,
            ranks / games_played AS value
            FROM playerdata
            ORDER BY value ASC
            LIMIT ${n}`, callback);
    }
    static getLBScore(n : number, callback : (data : SQLMap) => void) {
        this.queryHelper(`SELECT id,
            scores As value
            FROM playerdata
            ORDER BY value DESC
            LIMIT ${n}`, callback);
    }
    static getLBAverageScore(n : number, callback : (data : SQLMap) => void) {
        this.queryHelper(`SELECT id,
            scores / games_played AS value
            FROM playerdata
            ORDER BY value DESC
            LIMIT ${n}`, callback);
    }
    static getLBGamesPlayed(n : number, callback : (data : SQLMap) => void) {
        this.queryHelper(`SELECT id,
            games_played As value
            FROM playerdata
            ORDER BY value DESC
            LIMIT ${n}`, callback);
    }

    private static queryHelper(cmd : string, callback : (data : SQLMap) => void) {
        db.all(cmd, [], (err, rows : SQLMap) => {
                if (err) console.error(err);
                callback(rows);
            });
    }

}