import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'

const date = new Date();

export type GameInfo = {
    id: string[]
    scoreRaw: number[]
    scoreAdj: number[]
}

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
            CREATE TABLE IF NOT EXISTS DataGame 
            (id_game        TEXT NOT NULL UNIQUE, 
            date            INTEGER NOT NULL, 
            id_player_1     TEXT NOT NULL, 
            id_player_2     TEXT NOT NULL, 
            id_player_3     TEXT NOT NULL, 
            id_player_4     TEXT NOT NULL, 
            score_raw_1     INTEGER NOT NULL, 
            score_raw_2     INTEGER NOT NULL, 
            score_raw_3     INTEGER NOT NULL, 
            score_raw_4     INTEGER NOT NULL,
            score_adj_1     INTEGER NOT NULL, 
            score_adj_2     INTEGER NOT NULL, 
            score_adj_3     INTEGER NOT NULL, 
            score_adj_4     INTEGER NOT NULL)`);
        await this.db!.run(`
            CREATE TABLE IF NOT EXISTS DataPlayer 
            (id_player      TEXT NOT NULL UNIQUE,
            score_raw_total INTEGER NOT NULL,
            score_adj_total INTEGER NOT NULL,
            rank_total      INTEGER NOT NULL, 
            game_total      INTEGER NOT NULL)`);
    }

    static async insertData(id: string, data: GameInfo) {
        if (this.db == null) await this.init();

        console.log(data);

        let stmt: string[] = [];
        let curtime = date.getTime().toString();
        stmt.push(id);
        stmt.push(curtime);
        for (let i = 0; i < data.id.length; i++) {
            let id = data.id[i];
            let scoreRaw = data.scoreRaw[i];
            let scoreAdj = data.scoreAdj[i];
            this.db!.run(`
                INSERT INTO DataPlayer (id_player, score_raw_total, score_adj_total, rank_total, game_total) VALUES (${id}, ${scoreRaw}, ${scoreAdj}, ${i + 1}, ${1}) 
                ON CONFLICT (id_player) DO UPDATE SET 
                score_raw_total = score_raw_total + ${scoreRaw},
                score_adj_total = score_adj_total + ${scoreAdj},
                rank_total = rank_total + ${i + 1},
                game_total = game_total + ${1}`);

            stmt.push(id);
            stmt.push(scoreRaw.toString());
            stmt.push(scoreAdj.toString());
        }
        this.db!.run(`INSERT INTO DataGame (id_game, date, 
            id_player_1, score_raw_1, score_adj_1, 
            id_player_2, score_raw_2, score_adj_2,
            id_player_3, score_raw_3, score_adj_3,
            id_player_4, score_raw_4, score_adj_4) VALUES
            (${stmt.join(", ")})`);
    }

    static async getLBAveragePlacement(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id_player,
            rank_total * 1.0 / game_total AS rank_average
            FROM DataPlayer
            ORDER BY rank_average ASC
            LIMIT ${n}`);
    }
    static async getLBScore(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id_player,
            score_adj_total / 1000.0 AS score_adj_total
            FROM DataPlayer
            ORDER BY score_adj_total DESC
            LIMIT ${n}`);
    }
    static async getLBScoreRaw(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id_player,
            score_raw_total / 1000.0 AS score_raw_total
            FROM DataPlayer
            ORDER BY score_raw_total DESC
            LIMIT ${n}`);
    }
    static async getLBAverageScore(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id_player,
            score_adj_total / game_total / 1000.0 AS score_adj_average
            FROM DataPlayer
            ORDER BY score_adj_average DESC
            LIMIT ${n}`);
    }
    static async getLBAverageScoreRaw(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id_player,
            score_raw_total / game_total / 1000.0 AS score_raw_average
            FROM DataPlayer
            ORDER BY score_raw_average DESC
            LIMIT ${n}`);
    }
    static async getLBGamesPlayed(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id_player,
            game_total
            FROM DataPlayer
            ORDER BY game_total DESC
            LIMIT ${n}`);
    }
    static async getLBRecentGames(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id_game,
            date
            FROM DataGame
            ORDER BY date DESC
            LIMIT ${n}`);
    }

    static async getPlayerProfile(id: string): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id_player,
            score_adj_total / 1000.0 AS score_adj_total,
            score_adj_total / 1000.0 / game_total AS score_adj_average,
            score_raw_total / 1000.0 AS score_raw_total,
            score_raw_total / 1000.0 / game_total AS score_raw_average,
            rank_total / game_total AS rank_average,
            game_total
            FROM DataPlayer
            WHERE id_player = ${id}`);
    }

    static async getGameProfile(id: string): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id_game,
            date,
            id_player_1,
            id_player_2,
            id_player_3,
            id_player_4,
            score_adj_1 / 1000.0 AS score_adj_1,
            score_adj_2 / 1000.0 AS score_adj_2,
            score_adj_3 / 1000.0 AS score_adj_3,
            score_adj_4 / 1000.0 AS score_adj_4,
            score_raw_1 / 1000.0 AS score_raw_1,
            score_raw_2 / 1000.0 AS score_raw_2,
            score_raw_3 / 1000.0 AS score_raw_3,
            score_raw_4 / 1000.0 AS score_raw_4
            FROM DataGame
            WHERE id_game = ${id}`);
    }

    static async queryHelper(cmd: string): Promise<object[]> {
        if (this.db == null) await this.init();
        return await this.db!.all(cmd);
    }

    static async getEntireDB() {
        if (this.db == null) await this.init();
        let gamedata = await this.queryHelper(`SELECT * FROM DataGame`);
        let playerdata = await this.queryHelper(`SELECT * FROM DataPlayer`);
        return [gamedata, playerdata];
    }

}