import { LifetimeGameResultRow } from "./query_struct";

interface LifetimeGameResultLike {
    game_id: string;
    player_id: string;
    raw_score: number;
    placement: number;
    target: number;
    oka: number;
}

export interface LifetimeGameDeltaInput extends LifetimeGameResultLike {
    rank: number;
}

export interface LifetimeRankRule {
    name: string;
    start: number;
    limit: number | null;
    demotePoints: number | null;
    color: number;
    iconFile: string;
}

export interface LifetimePlayerState {
    player_id: string;
    rank: number;
    rank_name: string;
    points: number;
    rank_start: number;
    rank_limit: number | null;
    demote_points: number | null;
    games: number;
    total_adjusted_score: number;
    total_placement: number;
    promotions: number;
    score_adj_average: number;
    rank_average: number;
}

interface MutableLifetimePlayerState {
    player_id: string;
    rank: number;
    points: number;
    games: number;
    total_adjusted_score: number;
    total_placement: number;
    promotions: number;
}

const MIN_LIFETIME_POINTS = 0;

export const lifetimeRules = {
    rawScoreDivisor: 1000,
    basePlacementBonus: [30, 10, -10, -30] satisfies [number, number, number, number],
    opponentRankDifferenceMultiplier: 0.5,
    rankParticipationBonus: [10, 5, 0, 0, 0, 0] satisfies number[],
    ranks: [
        { name: "Novice", start: 0, limit: 100, demotePoints: null, color: 0x9acd32, iconFile: "Novice.png" },
        { name: "Adept", start: 150, limit: 300, demotePoints: 0, color: 0x15803d, iconFile: "Intermediate.png" },
        { name: "Expert", start: 200, limit: 400, demotePoints: 100, color: 0xd4a017, iconFile: "Expert.png" },
        { name: "Master", start: 250, limit: 500, demotePoints: 150, color: 0xc66a2b, iconFile: "Master.png" },
        { name: "Saint", start: 300, limit: 600, demotePoints: 200, color: 0xd94a73, iconFile: "Saint.png" },
        { name: "Celestial", start: 350, limit: null, demotePoints: 250, color: 0x38bdf8, iconFile: "Celestial.png" },
    ] satisfies LifetimeRankRule[],
};

function getLifetimeRankRule(rank: number): LifetimeRankRule {
    const index = Math.max(0, Math.min(rank - 1, lifetimeRules.ranks.length - 1));
    return lifetimeRules.ranks[index];
}

export function getLifetimeRankName(rank: number): string {
    return getLifetimeRankRule(rank).name;
}

export function getLifetimeRankColor(rank: number): number {
    return getLifetimeRankRule(rank).color;
}

export function getLifetimeRankIconFile(rank: number): string {
    return getLifetimeRankRule(rank).iconFile;
}

function getPlayer(players: Map<string, MutableLifetimePlayerState>, playerId: string): MutableLifetimePlayerState {
    const existing = players.get(playerId);
    if (existing) {
        return existing;
    }

    const player: MutableLifetimePlayerState = {
        player_id: playerId,
        rank: 1,
        points: 0,
        games: 0,
        total_adjusted_score: 0,
        total_placement: 0,
        promotions: 0,
    };
    players.set(playerId, player);
    return player;
}

interface LifetimeGamePlayerSnapshot {
    result: LifetimeGameResultLike;
    player?: MutableLifetimePlayerState;
    rank: number;
}

function getPlacementBonus(player: LifetimeGamePlayerSnapshot, table: LifetimeGamePlayerSnapshot[]): number {
    const tiedPlayers = table.filter(other => other.result.raw_score === player.result.raw_score);
    const placementBonuses = tiedPlayers.map((_, index) =>
        getPlacementBonusForPlace(player, table, player.result.placement + index)
    );

    return placementBonuses.reduce((sum, bonus) => sum + bonus, 0) / placementBonuses.length;
}

function getPlacementBonusForPlace(player: LifetimeGamePlayerSnapshot, table: LifetimeGamePlayerSnapshot[], placement: number): number {
    const basePlacementBonus = lifetimeRules.basePlacementBonus[placement - 1];
    if (basePlacementBonus === undefined) {
        throw new Error(`Invalid placement ${placement} in game ${player.result.game_id} for player ${player.result.player_id}.`);
    }

    const opponentRankDifference = table
        .filter(opponent => opponent.result.player_id !== player.result.player_id)
        .reduce((sum, opponent) => sum + opponent.rank - player.rank, 0);

    return basePlacementBonus + opponentRankDifference * lifetimeRules.opponentRankDifferenceMultiplier;
}

function getRankParticipationBonus(rank: number): number {
    return lifetimeRules.rankParticipationBonus[rank - 1] ?? 0;
}

function getLifetimeGameDelta(player: LifetimeGamePlayerSnapshot, table: LifetimeGamePlayerSnapshot[]): number {
    const scoreMovement = (player.result.raw_score - player.result.target + player.result.oka) / lifetimeRules.rawScoreDivisor;
    return Math.ceil(scoreMovement + getPlacementBonus(player, table) + getRankParticipationBonus(player.rank));
}

export function calculateLifetimeGameDeltas(results: LifetimeGameDeltaInput[]): Map<string, number> {
    const table = results.map(result => ({
        result,
        rank: result.rank,
    }));

    return new Map(table.map(player => [player.result.player_id, getLifetimeGameDelta(player, table)]));
}

function applyRankTransition(player: MutableLifetimePlayerState): void {
    const rankRule = getLifetimeRankRule(player.rank);

    if (rankRule.limit !== null && player.points >= rankRule.limit) {
        player.rank += 1;
        player.points = getLifetimeRankRule(player.rank).start;
        player.promotions += 1;
        return;
    }

    if (player.points <= MIN_LIFETIME_POINTS) {
        if (player.rank === 1) {
            player.points = MIN_LIFETIME_POINTS;
            return;
        }

        player.rank -= 1;
        player.points = rankRule.demotePoints ?? MIN_LIFETIME_POINTS;
    }
}

function applyLifetimeGame(player: MutableLifetimePlayerState, result: LifetimeGameResultRow, delta: number): void {
    if (delta === undefined) {
        throw new Error(`Invalid placement ${result.placement} in game ${result.game_id} for player ${result.player_id}.`);
    }

    player.games += 1;
    player.total_adjusted_score += result.adj_score;
    player.total_placement += result.placement;
    player.points += delta;
    applyRankTransition(player);
}

function applyLifetimeGameTable(players: Map<string, MutableLifetimePlayerState>, results: LifetimeGameResultRow[]): void {
    const table = results.map(result => {
        const player = getPlayer(players, result.player_id);
        return {
            result,
            player,
            rank: player.rank,
        };
    });

    const deltas = new Map(table.map(player => [player.result.player_id, getLifetimeGameDelta(player, table)]));
    for (const player of table) {
        applyLifetimeGame(player.player, player.result, deltas.get(player.result.player_id)!);
    }
}

function finalizePlayer(player: MutableLifetimePlayerState): LifetimePlayerState {
    const rankRule = getLifetimeRankRule(player.rank);
    return {
        ...player,
        rank_name: rankRule.name,
        rank_start: rankRule.start,
        rank_limit: rankRule.limit,
        demote_points: rankRule.demotePoints,
        score_adj_average: player.games === 0 ? 0 : player.total_adjusted_score / 1000 / player.games,
        rank_average: player.games === 0 ? 0 : player.total_placement / player.games,
    };
}

export function calculateLifetimeProgression(results: LifetimeGameResultRow[]): LifetimePlayerState[] {
    const players = new Map<string, MutableLifetimePlayerState>();
    let currentGameId: string | null = null;
    let currentGameResults: LifetimeGameResultRow[] = [];

    const flushGame = () => {
        if (currentGameResults.length > 0) {
            applyLifetimeGameTable(players, currentGameResults);
            currentGameResults = [];
        }
    };

    for (const result of results) {
        if (currentGameId !== null && result.game_id !== currentGameId) {
            flushGame();
        }
        currentGameId = result.game_id;
        currentGameResults.push(result);
    }
    flushGame();

    return [...players.values()]
        .map(finalizePlayer)
        .sort((a, b) => {
            if (b.rank !== a.rank) return b.rank - a.rank;
            if (b.points !== a.points) return b.points - a.points;
            if (b.games !== a.games) return b.games - a.games;
            return a.player_id.localeCompare(b.player_id);
        });
}
