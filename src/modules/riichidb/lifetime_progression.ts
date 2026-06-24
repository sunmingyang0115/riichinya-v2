import { LifetimeGameResultRow } from "./query_struct";

export interface LifetimeRankRule {
    name: string;
    threshold: number;
    placementBonus: [number, number, number, number];
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
    ranks: [
        { name: "Novice", threshold: 0, placementBonus: [20, 10, 0, -10] },
        { name: "Adept", threshold: 100, placementBonus: [20, 10, 0, -20] },
        { name: "Expert", threshold: 300, placementBonus: [20, 10, 0, -30] },
        { name: "Master", threshold: 600, placementBonus: [20, 10, 0, -35] },
        { name: "Saint", threshold: 1000, placementBonus: [20, 10, 0, -40] },
        { name: "Celestial", threshold: 1500, placementBonus: [20, 10, 0, -45] },
    ] satisfies LifetimeRankRule[],
};

export function getLifetimeRankName(rank: number): string {
    return lifetimeRules.ranks[rank - 1]?.name ?? lifetimeRules.ranks[lifetimeRules.ranks.length - 1].name;
}

export function getLifetimeNextRankThreshold(rank: number): number | null {
    return lifetimeRules.ranks[rank]?.threshold ?? null;
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

function applyLifetimeGame(player: MutableLifetimePlayerState, result: LifetimeGameResultRow): void {
    const rankRule = lifetimeRules.ranks[player.rank - 1];
    const placementBonus = rankRule.placementBonus[result.placement - 1];

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

    for (const result of results) {
        applyLifetimeGame(getPlayer(players, result.player_id), result);
    }

    return [...players.values()]
        .map(finalizePlayer)
        .sort((a, b) => {
            if (b.rank !== a.rank) return b.rank - a.rank;
            if (b.points !== a.points) return b.points - a.points;
            if (b.games !== a.games) return b.games - a.games;
            return a.player_id.localeCompare(b.player_id);
        });
}
