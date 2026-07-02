import { existsSync } from "fs";
import { resolve } from "path";
import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import {
    SQLConfigTable,
    SQLGameTable,
    SQLParticipantTable,
    SQLSeasonTable,
    type SeasonEntry,
} from "../modules/riichidb/db_struct";

type SqliteDatabase = Database<sqlite3.Database, sqlite3.Statement>;

const SOURCE_DB = "rdb.sql";
const TARGET_DB = "rdb2.sql";

const DEFAULT_TARGET = 25000;
const DEFAULT_OKA = 0;
const DEFAULT_UMA = [15000, 5000, -5000, -15000] as const;

type SeasonInput = [
    season_id: string,
    display_name: string,
    start_date: string,
    end_date: string,
];

const SEASONS: SeasonInput[] = [
    ["F24", "Fall 2024", "2024-09-01", "2024-12-31"],
    ["W25", "Winter 2025", "2025-01-01", "2025-04-30"],
    ["S25", "Spring 2025", "2025-05-01", "2025-08-31"],
    ["F25_1", "Fall 2025 Split 1", "2025-09-01", "2025-10-20"],
    ["F25_2", "Fall 2025 Split 2", "2025-10-21", "2025-12-31"],
    ["W26", "Winter 2026", "2026-01-01", "2026-04-30"],
    ["S26", "Spring 2026", "2026-05-01", "2026-08-31"],
];

const LEAGUE_SEASONS: SeasonInput[] = [
    ["S26_L", "Spring 2026 League", "2026-05-30", "2026-07-21"],
];

interface LegacyGameRow {
    id_game: string;
    date: number | string;
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
}

interface ParticipantRow {
    game_id: string;
    player_id: string;
    raw_score: number;
    adj_score: number;
    placement: number;
}

interface PlayerTotals {
    player_id: string;
    raw_total: number;
    adj_total: number;
    placement_total: number;
    game_total: number;
}

interface SeasonBounds {
    season: SeasonEntry;
    startTime: number;
    endTime: number;
}

async function openDatabase(filename: string): Promise<SqliteDatabase> {
    return open({
        filename,
        driver: sqlite3.Database,
    });
}

async function ensureTargetSchema(db: SqliteDatabase): Promise<void> {
    await db.run("PRAGMA foreign_keys = ON");
    await db.run(SQLSeasonTable);
    await db.run(SQLGameTable);
    await db.run(SQLParticipantTable);
    await db.run(SQLConfigTable);

    await db.run("create index if not exists idx_game_season on GameTable(season_id)");
    await db.run("create index if not exists idx_participant_game on ParticipantTable(game_id)");
    await db.run("create index if not exists idx_participant_player on ParticipantTable(player_id)");
}

function toDate(value: number | string): Date {
    const date = typeof value === "number" || /^\d+$/.test(value)
        ? new Date(Number(value))
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${value}`);
    }

    return date;
}

function toIsoDate(value: number | string): string {
    return toDate(value).toISOString();
}

function dateOnlyEndTime(value: string): number {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Date(`${value}T23:59:59.999Z`).getTime();
    }

    return toDate(value).getTime();
}

function makeSeasonEntries(inputs: SeasonInput[]): SeasonEntry[] {
    return inputs.map(([season_id, display_name, start_date, end_date]) => ({
        season_id,
        display_name,
        start_date,
        end_date,
        uma1: DEFAULT_UMA[0],
        uma2: DEFAULT_UMA[1],
        uma3: DEFAULT_UMA[2],
        uma4: DEFAULT_UMA[3],
        target: DEFAULT_TARGET,
        oka: DEFAULT_OKA,
    }));
}

function makeSeasons(): SeasonEntry[] {
    return makeSeasonEntries(SEASONS);
}

function makeLeagueSeasons(): SeasonEntry[] {
    return makeSeasonEntries(LEAGUE_SEASONS);
}

function makeSeasonBounds(seasons: SeasonEntry[]): SeasonBounds[] {
    const bounds = seasons
        .map(season => ({
            season,
            startTime: toDate(season.start_date).getTime(),
            endTime: dateOnlyEndTime(season.end_date),
        }))
        .sort((a, b) => a.startTime - b.startTime);

    const seenSeasonIds = new Set<string>();
    for (let i = 0; i < bounds.length; i++) {
        const current = bounds[i];
        if (current.startTime > current.endTime) {
            throw new Error(`Season ${current.season.season_id} starts after it ends`);
        }
        if (seenSeasonIds.has(current.season.season_id)) {
            throw new Error(`Duplicate season id: ${current.season.season_id}`);
        }
        seenSeasonIds.add(current.season.season_id);

        const previous = bounds[i - 1];
        if (previous && previous.endTime >= current.startTime) {
            throw new Error(`Season ranges overlap: ${previous.season.season_id} and ${current.season.season_id}`);
        }
    }

    return bounds;
}

function getSeasonForGame(game: LegacyGameRow, seasons: SeasonBounds[]): SeasonEntry {
    const gameTime = toDate(game.date).getTime();
    const match = seasons.find(season => season.startTime <= gameTime && gameTime <= season.endTime);

    if (!match) {
        throw new Error(`No season found for game ${game.id_game} on ${toIsoDate(game.date)}`);
    }

    return match.season;
}

async function readLegacyGames(sourceDb: SqliteDatabase): Promise<LegacyGameRow[]> {
    return sourceDb.all<LegacyGameRow[]>(`
        select
            id_game,
            date,
            id_player_1,
            id_player_2,
            id_player_3,
            id_player_4,
            score_raw_1,
            score_raw_2,
            score_raw_3,
            score_raw_4,
            score_adj_1,
            score_adj_2,
            score_adj_3,
            score_adj_4
        from DataGame
        order by date asc, id_game asc
    `);
}

function legacyGameToParticipants(game: LegacyGameRow, season: SeasonEntry): ParticipantRow[] {
    const umas = [season.uma1, season.uma2, season.uma3, season.uma4];
    const participants = [
        {
            game_id: game.id_game,
            player_id: game.id_player_1,
            raw_score: game.score_raw_1,
            adj_score: 0,
            placement: 0,
        },
        {
            game_id: game.id_game,
            player_id: game.id_player_2,
            raw_score: game.score_raw_2,
            adj_score: 0,
            placement: 0,
        },
        {
            game_id: game.id_game,
            player_id: game.id_player_3,
            raw_score: game.score_raw_3,
            adj_score: 0,
            placement: 0,
        },
        {
            game_id: game.id_game,
            player_id: game.id_player_4,
            raw_score: game.score_raw_4,
            adj_score: 0,
            placement: 0,
        },
    ];

    participants.sort((a, b) => b.raw_score - a.raw_score);

    for (let i = 0; i < participants.length; i++) {
        const start = i;
        const rawScore = participants[i].raw_score;
        while (i + 1 < participants.length && participants[i + 1].raw_score === rawScore) {
            i++;
        }

        const end = i + 1;
        const placement = start + 1;
        const umaShare = umas
            .slice(start, end)
            .reduce((total, uma) => total + uma, 0) / (end - start);

        for (let j = start; j < end; j++) {
            participants[j].placement = placement;
            participants[j].adj_score = participants[j].raw_score - season.target + season.oka + umaShare;
        }
    }

    return participants;
}

function getExpectedTotals(games: LegacyGameRow[], seasonBounds: SeasonBounds[]): PlayerTotals[] {
    const totalsByPlayer = new Map<string, PlayerTotals>();

    for (const game of games) {
        const season = getSeasonForGame(game, seasonBounds);
        for (const participant of legacyGameToParticipants(game, season)) {
            const totals = totalsByPlayer.get(participant.player_id);
            if (totals) {
                totals.raw_total += participant.raw_score;
                totals.adj_total += participant.adj_score;
                totals.placement_total += participant.placement;
                totals.game_total++;
            }
            else {
                totalsByPlayer.set(participant.player_id, {
                    player_id: participant.player_id,
                    raw_total: participant.raw_score,
                    adj_total: participant.adj_score,
                    placement_total: participant.placement,
                    game_total: 1,
                });
            }
        }
    }

    return [...totalsByPlayer.values()].sort((a, b) => a.player_id.localeCompare(b.player_id));
}

async function getTargetTotals(targetDb: SqliteDatabase, gameIds: string[]): Promise<PlayerTotals[]> {
    if (gameIds.length === 0) {
        return [];
    }

    const placeholders = gameIds.map(() => "?").join(", ");
    return targetDb.all<PlayerTotals[]>(`
        select player_id,
               sum(raw_score) as raw_total,
               sum(adj_score) as adj_total,
               sum(placement) as placement_total,
               count(*) as game_total
        from ParticipantTable
        where game_id in (${placeholders})
        group by player_id
        order by player_id asc
    `, gameIds);
}

function compareTotals(expected: PlayerTotals[], actual: PlayerTotals[]): string[] {
    const expectedByPlayer = new Map(expected.map(row => [row.player_id, row]));
    const actualByPlayer = new Map(actual.map(row => [row.player_id, row]));
    const messages: string[] = [];
    const allPlayerIds = new Set([...expectedByPlayer.keys(), ...actualByPlayer.keys()]);

    for (const playerId of [...allPlayerIds].sort()) {
        const expectedTotals = expectedByPlayer.get(playerId);
        const actualTotals = actualByPlayer.get(playerId);
        if (!expectedTotals || !actualTotals) {
            messages.push(`${playerId}: missing ${expectedTotals ? "target totals" : "source totals"}`);
            continue;
        }

        if (
            expectedTotals.raw_total !== actualTotals.raw_total ||
            expectedTotals.adj_total !== actualTotals.adj_total ||
            expectedTotals.placement_total !== actualTotals.placement_total ||
            expectedTotals.game_total !== actualTotals.game_total
        ) {
            messages.push(`${playerId}: expected raw=${expectedTotals.raw_total}, adj=${expectedTotals.adj_total}, placements=${expectedTotals.placement_total}, games=${expectedTotals.game_total}; target raw=${actualTotals.raw_total}, adj=${actualTotals.adj_total}, placements=${actualTotals.placement_total}, games=${actualTotals.game_total}`);
        }
    }

    return messages;
}

async function deleteExistingMigratedGames(db: SqliteDatabase, gameIds: string[]): Promise<void> {
    if (gameIds.length === 0) {
        return;
    }

    const placeholders = gameIds.map(() => "?").join(", ");

    await db.run(`
        delete from ParticipantTable
        where game_id in (${placeholders})
    `, gameIds);

    await db.run(`
        delete from GameTable
        where game_id in (${placeholders})
    `, gameIds);
}

async function insertSeasons(db: SqliteDatabase, seasons: SeasonEntry[]): Promise<void> {
    const stmt = await db.prepare(`
        insert into SeasonTable (
            season_id, display_name, start_date, end_date,
            uma1, uma2, uma3, uma4, target, oka
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(season_id) do update set
            display_name = excluded.display_name,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            uma1 = excluded.uma1,
            uma2 = excluded.uma2,
            uma3 = excluded.uma3,
            uma4 = excluded.uma4,
            target = excluded.target,
            oka = excluded.oka
    `);

    try {
        for (const season of seasons) {
            await stmt.run(
                season.season_id,
                season.display_name,
                season.start_date,
                season.end_date,
                season.uma1,
                season.uma2,
                season.uma3,
                season.uma4,
                season.target,
                season.oka,
            );
        }
    } finally {
        await stmt.finalize();
    }
}

async function insertGamesAndParticipants(
    db: SqliteDatabase,
    games: LegacyGameRow[],
    seasonBounds: SeasonBounds[],
): Promise<Map<string, number>> {
    const countsBySeason = new Map<string, number>();
    const gameStmt = await db.prepare(`
        insert into GameTable (game_id, season_id, notes, date)
        values (?, ?, ?, ?)
    `);
    const participantStmt = await db.prepare(`
        insert into ParticipantTable (game_id, player_id, raw_score, adj_score, placement)
        values (?, ?, ?, ?, ?)
    `);

    try {
        for (const game of games) {
            const season = getSeasonForGame(game, seasonBounds);

            countsBySeason.set(season.season_id, (countsBySeason.get(season.season_id) ?? 0) + 1);
            await gameStmt.run(game.id_game, season.season_id, "", toIsoDate(game.date));

            for (const participant of legacyGameToParticipants(game, season)) {
                await participantStmt.run(
                    participant.game_id,
                    participant.player_id,
                    participant.raw_score,
                    participant.adj_score,
                    participant.placement,
                );
            }
        }
    } finally {
        await gameStmt.finalize();
        await participantStmt.finalize();
    }

    return countsBySeason;
}

async function migrate(): Promise<void> {
    const sourcePath = resolve(process.cwd(), SOURCE_DB);
    const targetPath = resolve(process.cwd(), TARGET_DB);

    if (!existsSync(sourcePath)) {
        throw new Error(`Source database does not exist: ${sourcePath}`);
    }

    const seasons = makeSeasons();
    const leagueSeasons = makeLeagueSeasons();
    const seasonBounds = makeSeasonBounds(seasons);
    const sourceDb = await openDatabase(sourcePath);
    const targetDb = await openDatabase(targetPath);

    try {
        const games = await readLegacyGames(sourceDb);
        const expectedTotals = getExpectedTotals(games, seasonBounds);
        const gameIds = games.map(game => game.id_game);

        await ensureTargetSchema(targetDb);
        await targetDb.run("BEGIN");

        let countsBySeason: Map<string, number>;
        try {
            await deleteExistingMigratedGames(targetDb, gameIds);
            await insertSeasons(targetDb, [...seasons, ...leagueSeasons]);
            countsBySeason = await insertGamesAndParticipants(targetDb, games, seasonBounds);
            await targetDb.run(`
                insert into ConfigTable (key, value)
                values ('current_season', ?)
                on conflict(key) do update set value = excluded.value
            `, [seasons[seasons.length - 1].season_id]);
            if (leagueSeasons.length > 0) {
                await targetDb.run(`
                    insert into ConfigTable (key, value)
                    values ('current_league_season', ?)
                    on conflict(key) do update set value = excluded.value
                `, [leagueSeasons[leagueSeasons.length - 1].season_id]);
            }
            await targetDb.run("COMMIT");
        } catch (error) {
            await targetDb.run("ROLLBACK");
            throw error;
        }

        const targetTotals = await getTargetTotals(targetDb, gameIds);
        const discrepancies = compareTotals(expectedTotals, targetTotals);

        process.stdout.write(`Migrated ${games.length} games and ${games.length * 4} participants.\n`);
        for (const season of seasons) {
            process.stdout.write(`  ${season.season_id}: ${countsBySeason.get(season.season_id) ?? 0} games\n`);
        }

        if (discrepancies.length > 0) {
            process.stdout.write(`Found ${discrepancies.length} total mismatch(es):\n`);
            for (const discrepancy of discrepancies.slice(0, 10)) {
                process.stdout.write(`  - ${discrepancy}\n`);
            }
            process.exitCode = 1;
        } else {
            process.stdout.write("Migration verification passed.\n");
        }
    } finally {
        await sourceDb.close();
        await targetDb.close();
    }
}

migrate().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
});
