export interface LeaderboardEntry {
    player_id: string;
    rank_average: number;
    score_adj_total: number;
    score_raw_total: number;
    score_adj_average: number;
    score_raw_average: number;
    rank_total: number;
    game_total: number;
};

export type LeaderboardStatKey = keyof Omit<LeaderboardEntry, "player_id">;

export interface PlayerGameCount {
    player_id: string;
    game_total: number;
}

export interface PlayerProfile {
    player_id: string;
    total_score: number;
    total_placement: number;
    total_raw_score: number;
    highest_score: number;
    lowest_score: number;
    games_played: number;
    rank: number;
}

export interface OpponentDelta {
    opponent_id: string;
    adj_score_delta: number;
    games_played_together: number;
};

export interface RecentGameEntry {
    rank: number;
    adj_score: number;
    raw_score: number;
    date: string;
};

export interface PlayerComparison {
    games_played_together: number;
    player1_adj_total: number;
    player2_adj_total: number;
    player1_raw_total: number;
    player2_raw_total: number;
    player1_placement_total: number;
    player2_placement_total: number;
    player1_wins: number;
    player2_wins: number;
    player1_firsts: number;
    player1_seconds: number;
    player1_thirds: number;
    player1_fourths: number;
    player2_firsts: number;
    player2_seconds: number;
    player2_thirds: number;
    player2_fourths: number;
};

export interface PlayerComparisonGame {
    game_id: string;
    date: string;
    player1_raw_score: number;
    player1_adj_score: number;
    player1_placement: number;
    player2_raw_score: number;
    player2_adj_score: number;
    player2_placement: number;
};

export interface LifetimeGameResultRow {
    game_id: string;
    date: string;
    player_id: string;
    raw_score: number;
    adj_score: number;
    placement: number;
    target: number;
    oka: number;
};

export interface SeasonAdjustedStanding {
    player_id: string;
    score_adj_total: number;
    rank: number;
};

