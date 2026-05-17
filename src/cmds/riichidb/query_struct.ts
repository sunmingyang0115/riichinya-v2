
// since most sorting features were not used so I will only do fetches on these 3:

export interface LeaderboardEntry {
    player_id: string;
    score: number;
};

export interface PlayerProfile {
    player_id: string;
    total_score: number;
    total_raw_score: number;
    highest_score: number;
    lowest_score: number;
    games_played: number;
    average_placement: number;
    average_score: number;
    fish_against: [string, number];
    shark_against: [string, number];
}

export interface RecentGameEntry {
    rank: number;
    adj_score: number;
    raw_score: number;
    date: string;
};

