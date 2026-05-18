export interface LeaderboardEntry {
    player_id: string;
    score: number;
};

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

