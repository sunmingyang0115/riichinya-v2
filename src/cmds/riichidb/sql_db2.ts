import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import { GameEntry, ParticipantEntry, SeasonEntry, SQLConfigTable, SQLGameTable, SQLParticipantTable, SQLSeasonTable } from './db_struct';
import { LeaderboardEntry, PlayerProfile, RecentGameEntry } from './query_struct';
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

    public static async addSeason(season: SeasonEntry): Promise<void> {
        await this.db.addEntryToTable("SeasonTable", season);
    }
    public static async deleteSeason(season_id: string): Promise<void> {
        await this.db.deleteTableEntryByID("SeasonTable", {"season_id": season_id});
    }
    public static async getSeason(season_id: string): Promise<SeasonEntry | null> {
        return this.db.getTableEntryByID<SeasonEntry>("SeasonTable", {"season_id": season_id});
    }

    public static async addGame(game: GameEntry): Promise<void> {
        this.db.addEntryToTable("GameTable", game);
    }
    public static async deleteGame(game_id: string): Promise<void> {
        this.db.deleteTableEntryByID("GameTable", {"game_id": game_id});
    }
    public static async getGame(game_id: string): Promise<GameEntry | null> {
        return this.db.getTableEntryByID<GameEntry>("GameTable", {"game_id": game_id});
    }

    public static async addParticipant(participant: ParticipantEntry): Promise<void> {
        this.db.addEntryToTable("ParticipantTable", participant);
    }
    public static async deleteParticipant(player_id: string): Promise<void> {
        this.db.deleteTableEntryByID("ParticipantTable", {"player_id": player_id});
    }
    public static async getParticipant(player_id: string): Promise<ParticipantEntry | null> {
        return this.db.getTableEntryByID<ParticipantEntry>("ParticipantTable", {"player_id": player_id});
    }

    // public static async getLeaderboard(offset: number, limit: number, season_id: string): Promise<LeaderboardEntry[]> {
    //     let query = `
    //         select
    //             p.player_id,
    //             sum(p.adj_score) as score,
    //         from ParticipantTable p
    //             inner join GameTable g on p.game_id = g.game_id
    //             where g.season_id = ?
    //         group by p.player_id
    //         order by total_score desc
    //         limit ? offset ?
    //     `
    //     await this.init();
    //     return await this.db!.all<LeaderboardEntry[]>(query, [season_id, limit, offset])
    // }

    // public static async getRecentGames(offset: number, limit: number, season_id: string, player_id: string): 
    //     Promise<RecentGameEntry[]>
    // {
    //     let query = `
    //         select
    //             p.placement as rank,
    //             p.adj_score,
    //             p.raw_score,
    //             g.date
    //         from ParticipantTable p
    //             inner join GameTable g on p.game_id = g.game_id
    //             where g.season_id = ? and p.player_id = ?
    //         order by g.date desc
    //         limit ? offset ?
    //     `;
    //     await this.init();
    //     return await this.db!.all<RecentGameEntry[]>(query, [season_id, player_id, limit, offset]);
    // }

    // public static async getPlayerProfile(season_id: string, player_id: string): Promise<PlayerProfile | null> {
    //     let query = `
    //         select
    //             p.player_id,
    //             round(sum(p.adj_score), 1) as total_score,
    //             sum(p.raw_score) as total_raw_score,
    //             max(p.raw_score) as highest_score,
    //             min(p.raw_score) as lowest_score,
    //             count(p.game_id) as games_played,
    //             avg(p.placement) as average_placement,
    //             avg(p.adj_score) as average_score
    //         from ParticipantTable p
    //             inner join GameTable g on p.game_id = g.game_id
    //             where g.season_id = ? and p.player_id = ?
    //         group by p.player_id
    //     `;

    //     await this.init();
    //     const profile = await this.db!.get<PlayerProfile>(query, [season_id, player_id]);
    //     return profile || null;
    // }

    // // im lazy
    // public static async exec(cmd: string) {
    //     await this.init();
    //     await this.db!.run(cmd);
    // }


}


