import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { Collection } from "discord.js";

export type DataGameSQLEntry = {
	id_game: string;
	date: string;
	id_player_1: string;
	id_player_2: string;
	id_player_3: string;
	id_player_4: string;
	score_raw_1: number;
	score_raw_2: number;
	score_raw_3: number;
	score_raw_4: number;
	score_adj_1: number;
	score_adj_2: number;
	score_adj_3: number;
	score_adj_4: number;
};

export type DataPlayerSQLEntry = {
	id_player: string;
	score_raw_total: number;
	score_adj_total: number;
	rank_total: number;
	game_total: number;
};

export type PlayerGameResult = {
	rank: number;
	raw: number;
	adj: number;
	time: string;
};

export type PlayerProfile = {
	id_player: string;
	score_adj_total: number;
	score_adj_average: number;
	score_raw_total: number;
	score_raw_average: number;
	rank_total: number;
	game_total: number;
};

export type GameInfo = {
	id: string[];
	scoreRaw: number[];
	scoreAdj: number[];
};



export type playerDataAttr = "rank_average" | "score_adj_average" | "score_raw_average" | "score_adj_total" | "score_raw_total" | "rank_total" | "game_total";
const prompts = {
	"rank_average": "rank_total * 1.0 / game_total AS rank_average",
	"score_adj_average": "score_adj_total / game_total / 1000.0 AS score_adj_average",
	"score_raw_average": "score_raw_total / game_total / 1000.0 AS score_raw_average",
	"score_adj_total": "score_adj_total / 1000.0 AS score_adj_total",
	"score_raw_total": "score_raw_total / 1000.0 AS score_raw_total",
	"rank_total": "rank_total",
	"game_total": "game_total"
};
const order = {
	"rank_average": "rank_average ASC",
	"score_adj_average": "score_adj_average DESC",
	"score_raw_average": "score_raw_average DESC",
	"score_adj_total": "score_adj_total DESC",
	"score_raw_total": "score_raw_total DESC",
	"rank_total": "rank_total DESC",
	"game_total": "game_total DESC"
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
	private static async openDB(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
		return open({
			filename: "rdb.sql",
			driver: sqlite3.Database,
		});
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

	static async hasGameID(id: string): Promise<boolean> {
		if (this.db == null) await this.init();
		const row = await this.db!.all(
			`SELECT COUNT (*) FROM DataGame WHERE id_game = ?`,
			id
		);
		return row[0]["COUNT (*)"] == 1;
	}

	static async insertData(id: string, data: GameInfo) {
		if (this.db == null) await this.init();

		console.log(data);

		let stmt: string[] = [];
		let curtime = new Date().getTime().toString();
		stmt.push(id);
		stmt.push(curtime);
		for (let i = 0; i < data.id.length; i++) {
			let id = data.id[i];
			let scoreRaw = data.scoreRaw[i];
			let scoreAdj = data.scoreAdj[i];
			await this.db!.run(
				`
                INSERT INTO DataPlayer (id_player, score_raw_total, score_adj_total, rank_total, game_total) VALUES ($id, $scoreRaw, $scoreAdj, $ix1, 1) 
                ON CONFLICT (id_player) DO UPDATE SET 
                score_raw_total = score_raw_total + $scoreRaw,
                score_adj_total = score_adj_total + $scoreAdj,
                rank_total = rank_total + $ix1,
                game_total = game_total + 1`,
				{
					$id: id,
					$scoreRaw: scoreRaw,
					$scoreAdj: scoreAdj,
					$ix1: i + 1,
				}
			);

			stmt.push(id);
			stmt.push(scoreRaw.toString());
			stmt.push(scoreAdj.toString());
		}
		if (stmt.length != 14)
			throw Error(
				"assertion failed: stmt is not length 14 (DataGame cannot be inserted)"
			);
		await this.db!.run(
			`INSERT INTO DataGame (id_game, date, 
            id_player_1, score_raw_1, score_adj_1, 
            id_player_2, score_raw_2, score_adj_2,
            id_player_3, score_raw_3, score_adj_3,
            id_player_4, score_raw_4, score_adj_4) VALUES
            (?, ?, 
            ?, ?, ?, 
            ?, ?, ?, 
            ?, ?, ?, 
            ?, ?, ?)`,
			stmt
		);
	}

	
	static async getPlayerData(n: number, attr: playerDataAttr[]): Promise<Record<string,any>[]> {
		if (this.db == null) await this.init();
		console.log(attr);
		console.log(`
			SELECT id_player,
            ${attr.map(a => prompts[a]).join(", ")}
            FROM DataPlayer
            ORDER BY rank_average ASC
            LIMIT ?`)
		return await this.db!.all(
			`
			SELECT id_player,
            ${attr.map(a => prompts[a]).join(", ")}
            FROM DataPlayer
            ORDER BY ${order[attr[0]]}
            LIMIT ?`,
			n
		)
	}
	static async getLBRecentGames(n: number): Promise<Record<string,any>[]> {
		if (this.db == null) await this.init();
		return await this.db!.all(
			`
            SELECT id_game,
            date
            FROM DataGame
            ORDER BY date DESC
            LIMIT ?`,
			n
		);
	}

	static async getPlayerGames(id: string): Promise<DataGameSQLEntry[]> {
		if (this.db == null) await this.init();
		return await this.db!.all(
			`
            SELECT *
            FROM DataGame
            WHERE id_player_1 = ?
            OR id_player_2 = ?
            OR id_player_3 = ?
            OR id_player_4 = ?
            ORDER BY date DESC
        `,
			id,
			id,
			id,
			id
		);
	}

	static async getPlayerResults(id: string): Promise<Array<PlayerGameResult>> {
		let games = await RiichiDatabase.getPlayerGames(id);
		const results: Array<{ rank: number; raw: number; adj: number; time: string }> = [];
		for (const game of games) {
			for (let i = 1; i <= 4; i++) {
				if (game[`id_player_${i}` as keyof DataGameSQLEntry] === id) {
					results.push({
						rank: i,
						raw: game[`score_raw_${i}` as `score_raw_${1 | 2 | 3 | 4}`],
						adj: game[`score_adj_${i}` as `score_adj_${1 | 2 | 3 | 4}`],
						time: game.date,
					});
					break;
				}
			}
		}
		return results;
	}

	static async getOpponentDelta(
		id: string
	): Promise<Collection<string, { raw: number; adj: number; games: number }>> {
		let games = await RiichiDatabase.getPlayerGames(id);

		const opponentStats: Collection<string, { raw: number; adj: number; games: number }> =
			new Collection();

		games.forEach((game) => {
			// Find which seat the player is in and get their adjusted score
			let playerSeat = -1;
			let playerRaw = 0;
			let playerAdj = 0;
			for (let i = 1; i <= 4; i++) {
				if (game[`id_player_${i}` as keyof DataGameSQLEntry] === id) {
					playerSeat = i;
					//wtf that works
					playerRaw = game[`score_raw_${i}` as `score_raw_${1 | 2 | 3 | 4}`];
					playerAdj = game[`score_adj_${i}` as `score_adj_${1 | 2 | 3 | 4}`];
					break;
				}
			}
			if (playerSeat === -1) return; // Should not happen

			// Compare against each opponent
			for (let i = 1; i <= 4; i++) {
				const opponentId = game[`id_player_${i}` as `id_player_${1 | 2 | 3 | 4}`];
				if (opponentId === id) continue;
				const opponentRaw = game[`score_raw_${i}` as `score_raw_${1 | 2 | 3 | 4}`];
				const opponentAdj = game[`score_adj_${i}` as `score_adj_${1 | 2 | 3 | 4}`];
				const rawDiff = playerRaw - opponentRaw;
				const adjDiff = playerAdj - opponentAdj;
				if (!opponentStats.has(opponentId)) {
					opponentStats.set(opponentId, { raw: 0, adj: 0, games: 0 });
				}
				const stat = opponentStats.get(opponentId)!;
				stat.raw += rawDiff;
				stat.adj += adjDiff;
				stat.games += 1;
			}
		});

		return opponentStats;
	}

	static async getPlayerRank(id: string): Promise<[{rank: number}]> {
		if (this.db == null) await this.init();
		return await this.db!.all(`
			SELECT rank FROM (
			SELECT
				id_player,
				RANK() OVER (ORDER BY score_adj_total * 1.0 DESC) AS rank
			FROM DataPlayer
			)
			WHERE id_player = ?`, id);
	}

	static async getPlayerProfile(id: string): Promise<PlayerProfile[]> {
		if (this.db == null) await this.init();
		return await this.db!.all(
			`
            SELECT id_player,
            score_adj_total / 1000.0 AS score_adj_total,
            score_adj_total / 1000.0 / game_total AS score_adj_average,
            score_raw_total / 1000.0 AS score_raw_total,
            score_raw_total / 1000.0 / game_total AS score_raw_average,
            rank_total,
            game_total 
            FROM DataPlayer
            WHERE id_player = ?`,
			id
		);
	}

	static async getPlayerRankByAdjAverage(id: string): Promise<number | null> {
		if (this.db == null) await this.init();
		const all = await this.db!.all(`
			SELECT id_player, score_adj_total * 1.0 / game_total AS score_adj_average
			FROM DataPlayer
			ORDER BY score_adj_average DESC
		`);
		const rank = all.findIndex((row: any) => row.id_player === id);
		return rank !== -1 ? rank + 1 : null;
	}

	static async getPlayerProfileWithRank(id: string): Promise<(PlayerProfile & { rank_adj_average: number | null })[]> {
		const profile = await this.getPlayerProfile(id);
		const rank = await this.getPlayerRankByAdjAverage(id);
		return profile.map(p => ({ ...p, rank_adj_average: rank }));
	}

	static async getGameProfile(id: string): Promise<DataGameSQLEntry[]> {
		if (this.db == null) await this.init();
		return await this.db!.all(
			`
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
            WHERE id_game = ?`,
			id
		);
	}

	static async getEntireDB() {
		if (this.db == null) await this.init();
		let gamedata = await this.db!.all(`SELECT * FROM DataGame`);
		let playerdata = await this.db!.all(`SELECT * FROM DataPlayer`);
		return [gamedata, playerdata];
	}
}
