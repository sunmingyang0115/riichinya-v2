import { LifetimeGameResultRow } from "./query_struct";

export interface LifetimeRankRule {
    name: string;
    threshold: number;
    color: number;
    iconFile: string;
}

export interface LifetimePlayerState {
    player_id: string;
    rank: number;
    rank_name: string;
    points: number;
    next_rank_threshold: number | null;
    floor: number;
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
    floor: number;
    games: number;
    total_adjusted_score: number;
    total_placement: number;
    promotions: number;
}

export const lifetimeRules = {
    participationPoints: 0,
    adjustedScoreDivisor: 1000,
    basePlacementBonus: [20, 10, 0, -30] satisfies [number, number, number, number],
    opponentRankDifferenceMultiplier: 5,
    ranks: [
        { name: "Novice", threshold: 0, color: 0x9acd32, iconFile: "Novice.png" },
        { name: "Adept", threshold: 100, color: 0x15803d, iconFile: "Intermediate.png" },
        { name: "Expert", threshold: 300, color: 0xd4a017, iconFile: "Expert.png" },
        { name: "Master", threshold: 600, color: 0xc66a2b, iconFile: "Master.png" },
        { name: "Saint", threshold: 1000, color: 0xd94a73, iconFile: "Saint.png" },
        { name: "Celestial", threshold: 1500, color: 0x38bdf8, iconFile: "Celestial.png" },
    ] satisfies LifetimeRankRule[],
};

export function getLifetimeRankName(rank: number): string {
    return lifetimeRules.ranks[rank - 1]?.name ?? lifetimeRules.ranks[lifetimeRules.ranks.length - 1].name;
}

export function getLifetimeNextRankThreshold(rank: number): number | null {
    return lifetimeRules.ranks[rank]?.threshold ?? null;
}

export function getLifetimeRankColor(rank: number): number {
    return lifetimeRules.ranks[rank - 1]?.color ?? lifetimeRules.ranks[0].color;
}

export function getLifetimeRankIconFile(rank: number): string {
    return lifetimeRules.ranks[rank - 1]?.iconFile ?? lifetimeRules.ranks[0].iconFile;
}

function rankFloor(rank: number): number {
    return lifetimeRules.ranks[rank - 1]?.threshold ?? lifetimeRules.ranks[lifetimeRules.ranks.length - 1].threshold;
}

function rankForPoints(points: number): number {
    let rank = 1;

    for (let i = 0; i < lifetimeRules.ranks.length; i++) {
        if (points >= lifetimeRules.ranks[i].threshold) {
            rank = i + 1;
        }
    }

    return rank;
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
        floor: 0,
        games: 0,
        total_adjusted_score: 0,
        total_placement: 0,
        promotions: 0,
    };
    players.set(playerId, player);
    return player;
}

interface LifetimeGamePlayerSnapshot {
    result: LifetimeGameResultRow;
    player: MutableLifetimePlayerState;
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

    if (placement !== 4) {
        return basePlacementBonus;
    }

    const opponentRankDifference = table
        .filter(opponent => opponent.result.player_id !== player.result.player_id)
        .reduce((sum, opponent) => sum + opponent.rank - player.rank, 0);

    return basePlacementBonus + opponentRankDifference * lifetimeRules.opponentRankDifferenceMultiplier;
}

function applyLifetimeGame(player: MutableLifetimePlayerState, result: LifetimeGameResultRow, placementBonus: number): void {
    if (placementBonus === undefined) {
        throw new Error(`Invalid placement ${result.placement} in game ${result.game_id} for player ${result.player_id}.`);
    }

    const performancePoints = result.adj_score / lifetimeRules.adjustedScoreDivisor;
    const delta = lifetimeRules.participationPoints + performancePoints + placementBonus;

    player.games += 1;
    player.total_adjusted_score += result.adj_score;
    player.total_placement += result.placement;
    player.points = Math.max(player.floor, player.points + delta);

    const nextRank = rankForPoints(player.points);
    if (nextRank > player.rank) {
        player.rank = nextRank;
        player.floor = rankFloor(nextRank);
        player.promotions += 1;
    }
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

    const placements = new Map(table.map(player => [player.result.player_id, getPlacementBonus(player, table)]));
    for (const player of table) {
        applyLifetimeGame(player.player, player.result, placements.get(player.result.player_id)!);
    }
}

function finalizePlayer(player: MutableLifetimePlayerState): LifetimePlayerState {
    return {
        ...player,
        rank_name: getLifetimeRankName(player.rank),
        next_rank_threshold: getLifetimeNextRankThreshold(player.rank),
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
