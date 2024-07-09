
import sqlite3 from "sqlite3";
sqlite3.verbose()

const db = new sqlite3.Database('rdb.sql');
const date = new Date();

export type GameInfo = {
    id : string,
    value : number
}[];

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
                (id             TEXT NOT NULL UNIQUE, 
                date            INTEGER NOT NULL, 
                player_id1      TEXT NOT NULL, 
                player_id2      TEXT NOT NULL, 
                player_id3      TEXT NOT NULL, 
                player_id4      TEXT NOT NULL, 
                score1          INTEGER NOT NULL, 
                score2          INTEGER NOT NULL, 
                score3          INTEGER NOT NULL, 
                score4          INTEGER NOT NULL)`);
            db.run(`CREATE TABLE IF NOT EXISTS playerdata 
                (id             TEXT NOT NULL UNIQUE ,
                scores          INTEGER NOT NULL, 
                ranks           INTEGER NOT NULL, 
                games_played    INTEGER NOT NULL)`);
        })
    }

    static insertData(id : string, data : GameInfo) {
        let stmt : string[] = [];
        let curtime = date.getTime().toString();
        stmt.push(id);
        stmt.push(curtime);
        // console.log(data);
        for (let i = 0; i < 4; i++) {
            let pair = data[i];
            stmt.push(pair.id.toString());
            stmt.push(pair.value.toString());
            db.run(`INSERT INTO playerdata (id, scores, ranks, games_played) VALUES (${pair.id}, ${pair.value}, ${i+1}, ${1}) 
                ON CONFLICT (id) DO UPDATE SET 
                scores = scores + ${pair.value},
                ranks = ranks + ${i},
                games_played = games_played + ${1}`);
        }
        db.run(`INSERT INTO gamedata (id, date, player_id1, score1, player_id2, score2, player_id3, score3, player_id4, score4) VALUES (${stmt.join(", ")})`);
    }

    static getLBAveragePlacement(n : number, callback : (data : object[]) => void) {
        this.queryHelper(`SELECT id,
            ranks / games_played AS avg_rank
            FROM playerdata
            ORDER BY avg_rank ASC
            LIMIT ${n}`, callback);
    }
    static getLBScore(n : number, callback : (data : object[]) => void) {
        this.queryHelper(`SELECT id,
            scores / 1000.0 AS total_scores
            FROM playerdata
            ORDER BY total_scores DESC
            LIMIT ${n}`, callback);
    }
    static getLBAverageScore(n : number, callback : (data : object[]) => void) {
        this.queryHelper(`SELECT id,
            scores / games_played / 1000.0 AS avg_scores
            FROM playerdata
            ORDER BY avg_scores DESC
            LIMIT ${n}`, callback);
    }
    static getLBGamesPlayed(n : number, callback : (data : object[]) => void) {
        this.queryHelper(`SELECT id,
            games_played AS games_played
            FROM playerdata
            ORDER BY games_played DESC
            LIMIT ${n}`, callback);
    }
    static getLBRecentGames(n : number, callback : (data : object[]) => void) {
        this.queryHelper(`SELECT id,
            date AS date
            FROM gamedata
            ORDER BY date DESC
            LIMIT ${n}`, callback);
    }

    static getPlayerProfile(id : string, callback : (data : object[]) => void) {
        this.queryHelper(`SELECT id,
            scores / 1000.0 AS total_scores,
            scores / 1000.0 / games_played AS avg_score,
            ranks / games_played AS avg_rank,
            games_played
            FROM playerdata
            WHERE id = ${id}`, callback);
    }

    static getGameProfile(id : string, callback : (data : object[]) => void) {
        this.queryHelper(`SELECT id,
            date,
            player_id1,
            player_id2,
            player_id3,
            player_id4,
            score1 / 1000.0 AS score1,
            score2 / 1000.0 AS score2,
            score3 / 1000.0 AS score3,
            score4 / 1000.0 AS score4
            FROM gamedata
            WHERE id = ${id}`, callback);
    }

    private static queryHelper(cmd : string, callback : (data : object[]) => void) {
        db.all(cmd, [], (err : Error | null, rows : object[]) => {
                if (err) console.error(err);
                // console.log(rows);
                callback(rows);
            });
            
    }

}