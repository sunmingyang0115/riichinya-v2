/**
 * SQLMap is just an array of {id, value} used for db
 */
export type SQLMap = {id : string, value : number}[]
export type rdbPlayerInfo = {
    id : string, 
    total_scores : number, 
    avg_score : number, 
    avg_rank : number, 
    games_played : number
};
export type rdbGameInfo = {
    id : string, 
    date : number,
    player_id1 : number, 
    player_id2 : number, 
    player_id3 : number, 
    player_id4 : number, 
    score1 : number,
    score2 : number,
    score3 : number,
    score4 : number,
};