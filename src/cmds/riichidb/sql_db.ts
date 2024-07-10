import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'

const date = new Date();

export type GameInfo = {
    id: string,
    value: number
}[];



export class RiichiDatabase {
    private static db: Database | null = null;
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
    private static async openDB () : Promise<Database<sqlite3.Database, sqlite3.Statement>>{
        return open({
          filename: 'rdb.sql',
          driver: sqlite3.Database
        })
      }

    static async init() {
        this.db = await this.openDB();
        await this.db!.run(`
            CREATE TABLE IF NOT EXISTS gamedata 
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
        await this.db!.run(`
            CREATE TABLE IF NOT EXISTS playerdata 
            (id             TEXT NOT NULL UNIQUE ,
            scores          INTEGER NOT NULL, 
            ranks           INTEGER NOT NULL, 
            games_played    INTEGER NOT NULL)`);
    }

    static async insertData(id: string, data: GameInfo) {
        if (this.db == null) await this.init();

        let stmt: string[] = [];
        let curtime = date.getTime().toString();
        stmt.push(id);
        stmt.push(curtime);
        // console.log(data);
        for (let i = 0; i < 4; i++) {
            let pair = data[i];
            stmt.push(pair.id.toString());
            stmt.push(pair.value.toString());
            this.db!.run(`
                INSERT INTO playerdata (id, scores, ranks, games_played) VALUES (${pair.id}, ${pair.value}, ${i + 1}, ${1}) 
                ON CONFLICT (id) DO UPDATE SET 
                scores = scores + ${pair.value},
                ranks = ranks + ${i},
                games_played = games_played + ${1}`);
        }
        this.db!.run(`INSERT INTO gamedata (id, date, player_id1, score1, player_id2, score2, player_id3, score3, player_id4, score4) VALUES (${stmt.join(", ")})`);
    }

    static async getLBAveragePlacement(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id AS player_id,
            ranks / games_played AS avg_rank
            FROM playerdata
            ORDER BY avg_rank ASC
            LIMIT ${n}`);
    }
    static async getLBScore(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id AS player_id,
            scores / 1000.0 AS total_scores
            FROM playerdata
            ORDER BY total_scores DESC
            LIMIT ${n}`);
    }
    static async getLBAverageScore(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id AS player_id,
            scores / games_played / 1000.0 AS avg_scores
            FROM playerdata
            ORDER BY avg_scores DESC
            LIMIT ${n}`);
    }
    static async getLBGamesPlayed(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id AS player_id,
            games_played
            FROM playerdata
            ORDER BY games_played DESC
            LIMIT ${n}`);
    }
    static async getLBRecentGames(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id AS game_id,
            date
            FROM gamedata
            ORDER BY date DESC
            LIMIT ${n}`);
    }

    static async getPlayerProfile(id: string): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id,
            scores / 1000.0 AS total_scores,
            scores / 1000.0 / games_played AS avg_score,
            ranks / games_played AS avg_rank,
            games_played
            FROM playerdata
            WHERE id = ${id}`);
    }

    static async getGameProfile(id: string): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id,
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
            WHERE id = ${id}`);
    }

    static async queryHelper(cmd: string): Promise<object[]> {
        if (this.db == null) await this.init();
        return await this.db!.all(cmd);
    }

    static async getEntireDB() {
        if (this.db == null) await this.init();
        let gamedata = await this.queryHelper(`SELECT * FROM gamedata`);
        let playerdata = await this.queryHelper(`SELECT * FROM playerdata`);
        return [gamedata, playerdata];
    }

}