import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import { ConfigEntry, GameEntry, ParticipantEntry, SeasonEntry, SQLConfigTable, SQLGameTable, SQLParticipantTable, SQLSeasonTable } from './db_struct';
import { LeaderboardEntry, OpponentDelta, PlayerComparison, PlayerComparisonGame, PlayerProfile, RecentGameEntry } from './query_struct';
import { off } from 'process';
import { DatabaseWrapper } from '../../database/database_wrapper';

export class RiichiDatabase {
    private static db: DatabaseWrapper = new DatabaseWrapper("rdb2.sql", e => this.init(e));

    private static async init(db: Database) {
        await db.run('PRAGMA foreign_keys = ON;');
        await db.run(SQLSeasonTable)
        await db.run(SQLGameTable)
        await db.run(SQLParticipantTable)
        await db.run(SQLConfigTable)
    }

    // ***

    public static async addConfig(config: ConfigEntry): Promise<void> {
        await this.db.addEntryToTable("ConfigTable", config);
    }
    public static async deleteConfig(key: string): Promise<void> {
        await this.db.deleteTableEntryByID("ConfigTable", {"key": key});
    }
    public static async getConfig(key: string): Promise<ConfigEntry | null> {
        return await this.db.getTableEntryByID<ConfigEntry>("ConfigTable", {"key": key});
    }

    public static async addSeason(season: SeasonEntry): Promise<void> {
        await this.db.addEntryToTable("SeasonTable", season);
    }
    public static async deleteSeason(season_id: string): Promise<void> {
        await this.db.deleteTableEntryByID("SeasonTable", {"season_id": season_id});
    }
    public static async getSeason(season_id: string): Promise<SeasonEntry | null> {
        return await this.db.getTableEntryByID<SeasonEntry>("SeasonTable", {"season_id": season_id});
    }

    public static async addGame(game: GameEntry): Promise<void> {
        await this.db.addEntryToTable("GameTable", game);
    }
    public static async deleteGame(game_id: string): Promise<void> {
        await this.db.deleteTableEntryByID("GameTable", {"game_id": game_id});
    }
    public static async getGame(game_id: string): Promise<GameEntry | null> {
        return await this.db.getTableEntryByID<GameEntry>("GameTable", {"game_id": game_id});
    }

    public static async addParticipant(participant: ParticipantEntry): Promise<void> {
        await this.db.addEntryToTable("ParticipantTable", participant);
    }
    public static async deleteParticipant(player_id: string, game_id: string): Promise<void> {
        await this.db.deleteTableEntryByID("ParticipantTable", {"player_id": player_id, "game_id": game_id});
    }
    public static async getParticipant(player_id: string, game_id: string): Promise<ParticipantEntry | null> {
        return await this.db.getTableEntryByID<ParticipantEntry>("ParticipantTable", {"player_id": player_id, "game_id": game_id});
    }

    // special queries

    public static async getAllParticipants(game_id: string): Promise<ParticipantEntry[]> {
        const query = `
            select * from ParticipantTable where game_id = ?
        `
        const db = await this.db.getDB();
        return await db.all<ParticipantEntry[]>(query, [game_id]);
    }

    public static async getCurrentSeasonEnsureExists(): Promise<SeasonEntry | null> {
        const query = `
            select s.* 
            from ConfigTable c
                inner join SeasonTable s on c.value = s.season_id
            where c.key = 'current_season'
            limit 1
        `;
        const database = await this.db.getDB();
        const result = await database.get<SeasonEntry>(query);
        return result || null;
    }

    public static async setCurrentSeasonEnsureExists(season_id: string): Promise<void> {
        const db = await this.db.getDB();
        const checkQuery = `
            select 1 
            from SeasonTable 
            where season_id = ? 
            limit 1
        `;
        if (!await db.get(checkQuery, [season_id])) {
            throw new Error(`season_id ${season_id} does not exist in SeasonTable`);
        }
        const updateQuery = `
            insert into ConfigTable (key, value) 
            values ('current_season', ?)
            on conflict(key) do update set value = excluded.value
        `;
        await db.run(updateQuery, [season_id]);
    }

    public static async getLeaderboard(offset: number, limit: number, season_id: string | null): Promise<LeaderboardEntry[]> {
        let query = `
            select
                p.player_id,
                sum(p.adj_score) as score
            from ParticipantTable p
                inner join GameTable g on p.game_id = g.game_id
                where (? is null or g.season_id = ?)
            group by p.player_id
            order by score desc
            limit ? offset ?
        `
        const db = await this.db.getDB();
        return await db.all<LeaderboardEntry[]>(query, [season_id, season_id, limit, offset])
    }   

    public static async getRecentGames(offset: number, limit: number, season_id: string | null, player_id: string): 
        Promise<RecentGameEntry[]>
    {
        let query = `
            select
                p.placement as rank,
                p.adj_score,
                p.raw_score,
                g.date
            from ParticipantTable p
                inner join GameTable g on p.game_id = g.game_id
                where (? is null or g.season_id = ?)
                    and p.player_id = ?
            order by g.date desc
            limit ? offset ?
        `;
        const db = await this.db.getDB();
        return await db.all<RecentGameEntry[]>(query, [season_id, season_id, player_id, limit, offset]);
    }

    public static async getPlayerProfile(season_id: string | null, player_id: string): Promise<PlayerProfile | null> {
        let query = `
            with LB as (
            select
                p.player_id,
                sum(p.adj_score) as total_score,
                sum(p.raw_score) as total_raw_score,
                max(p.raw_score) as highest_score,
                min(p.raw_score) as lowest_score,
                count(p.game_id) as games_played,
                sum(p.placement) as total_placement,
                rank() over (order by sum(p.adj_score) desc) as rank
            from ParticipantTable p
                inner join GameTable g on p.game_id = g.game_id
                where (? is null or g.season_id = ?)
            group by p.player_id
            )
            select * from LB where player_id = ?
        `;

        const db = await this.db.getDB();
        const profile = await db.get<PlayerProfile>(query, [season_id, season_id, player_id]);
        return profile || null;
    }

    public static async getOpponentDelta(offset: number, limit: number, season_id: string | null, player_id: string): Promise<OpponentDelta[]> {
        let query = `
            select
                opps.player_id as opponent_id,
                sum(p.adj_score) as adj_score_delta,
                count(opps.game_id) as games_played_together
            from ParticipantTable p
                inner join ParticipantTable opps
                    on p.game_id = opps.game_id
                inner join GameTable g
                    on p.game_id = g.game_id
            where (? is null or g.season_id = ?)
                and p.player_id = ?
                and opps.player_id != ?
            group by opps.player_id
            order by adj_score_delta desc
            limit ? offset ?
        `
        const db = await this.db.getDB();
        return await db.all<OpponentDelta[]>(query, [season_id, season_id, player_id, player_id, limit, offset]);
    }

    public static async getPlayerComparison(season_id: string | null, player1_id: string, player2_id: string): Promise<PlayerComparison | null> {
        const query = `
            select
                count(*) as games_played_together,
                sum(p1.adj_score) as player1_adj_total,
                sum(p2.adj_score) as player2_adj_total,
                sum(p1.raw_score) as player1_raw_total,
                sum(p2.raw_score) as player2_raw_total,
                sum(p1.placement) as player1_placement_total,
                sum(p2.placement) as player2_placement_total,
                sum(case when p1.placement < p2.placement then 1 else 0 end) as player1_wins,
                sum(case when p2.placement < p1.placement then 1 else 0 end) as player2_wins,
                sum(case when p1.placement = 1 then 1 else 0 end) as player1_firsts,
                sum(case when p1.placement = 2 then 1 else 0 end) as player1_seconds,
                sum(case when p1.placement = 3 then 1 else 0 end) as player1_thirds,
                sum(case when p1.placement = 4 then 1 else 0 end) as player1_fourths,
                sum(case when p2.placement = 1 then 1 else 0 end) as player2_firsts,
                sum(case when p2.placement = 2 then 1 else 0 end) as player2_seconds,
                sum(case when p2.placement = 3 then 1 else 0 end) as player2_thirds,
                sum(case when p2.placement = 4 then 1 else 0 end) as player2_fourths
            from ParticipantTable p1
                inner join ParticipantTable p2
                    on p1.game_id = p2.game_id
                        and p2.player_id = ?
                inner join GameTable g
                    on p1.game_id = g.game_id
            where p1.player_id = ?
                and (? is null or g.season_id = ?)
        `;

        const db = await this.db.getDB();
        const result = await db.get<PlayerComparison>(query, [player2_id, player1_id, season_id, season_id]);
        if (!result || result.games_played_together === 0) {
            return null;
        }
        return result;
    }

    public static async getRecentPlayerComparisonGames(season_id: string | null, player1_id: string, player2_id: string, limit: number): Promise<PlayerComparisonGame[]> {
        const query = `
            select
                g.game_id,
                g.date,
                p1.raw_score as player1_raw_score,
                p1.adj_score as player1_adj_score,
                p1.placement as player1_placement,
                p2.raw_score as player2_raw_score,
                p2.adj_score as player2_adj_score,
                p2.placement as player2_placement
            from ParticipantTable p1
                inner join ParticipantTable p2
                    on p1.game_id = p2.game_id
                        and p2.player_id = ?
                inner join GameTable g
                    on p1.game_id = g.game_id
            where p1.player_id = ?
                and (? is null or g.season_id = ?)
            order by g.date desc
            limit ?
        `;

        const db = await this.db.getDB();
        return await db.all<PlayerComparisonGame[]>(query, [player2_id, player1_id, season_id, season_id, limit]);
    }

    // // im lazy
    // public static async exec(cmd: string) {
    //     await this.init();
    //     await this.db!.run(cmd);
    // }


}


