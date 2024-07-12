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
            CREATE TABLE IF NOT EXISTS DataGame 
            (id_game        TEXT NOT NULL UNIQUE, 
            date            INTEGER NOT NULL, 
            id_player_1     TEXT NOT NULL, 
            id_player_2     TEXT NOT NULL, 
            id_player_3     TEXT NOT NULL, 
            id_player_4     TEXT NOT NULL, 
            score_1         INTEGER NOT NULL, 
            score_2         INTEGER NOT NULL, 
            score_3         INTEGER NOT NULL, 
            score_4         INTEGER NOT NULL)`);
        await this.db!.run(`
            CREATE TABLE IF NOT EXISTS DataPlayer 
            (id_player      TEXT NOT NULL UNIQUE ,
            score_total     INTEGER NOT NULL, 
            rank_total      INTEGER NOT NULL, 
            game_total      INTEGER NOT NULL)`);
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
                INSERT INTO DataPlayer (id_player, score_total, rank_total, game_total) VALUES (${pair.id}, ${pair.value}, ${i + 1}, ${1}) 
                ON CONFLICT (id_player) DO UPDATE SET 
                score_total = score_total + ${pair.value},
                rank_total = rank_total + ${i},
                game_total = game_total + ${1}`);
        }
        this.db!.run(`INSERT INTO DataGame (id_game, date, id_player_1, score_1, id_player_2, score_2, id_player_3, score_3, id_player_4, score_4) VALUES (${stmt.join(", ")})`);
    }

    static async getLBAveragePlacement(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id_player,
            rank_total / game_total AS rank_average
            FROM DataPlayer
            ORDER BY rank_average ASC
            LIMIT ${n}`);
    }
    static async getLBScore(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id_player,
            score_total / 1000.0 AS score_total
            FROM DataPlayer
            ORDER BY score_total DESC
            LIMIT ${n}`);
    }
    static async getLBAverageScore(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id_player,
            score_total / game_total / 1000.0 AS score_average
            FROM DataPlayer
            ORDER BY score_average DESC
            LIMIT ${n}`);
    }
    static async getLBGamesPlayed(n: number): Promise<object[]> {
        return await this.queryHelper(`
            SELECT id_player,
            game_total
            FROM DataPlayer
            ORDER BY games_total DESC
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
            score_total / 1000.0 AS score_total,
            score_total / 1000.0 / game_total AS score_average,
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
            score_1 / 1000.0 AS score_1,
            score_2 / 1000.0 AS score_2,
            score_3 / 1000.0 AS score_3,
            score_4 / 1000.0 AS score_4
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