export interface GameEntry {
    game_id: string;
    season_id: string;
    notes: string;
    date: string;
}

export const SQLGameTable = `
    create table if not exists GameTable (
        game_id     text not null primary key,
        season_id   text not null,
        notes       text,
        date        text not null,

        foreign key (season_id) references SeasonTable(season_id) on delete restrict
    )
`


export interface SeasonEntry {
    season_id: string;
    display_name: string;
    start_date: string;
    end_date: string;
    uma1: number;
    uma2: number;
    uma3: number;
    uma4: number;
    oka: number;
}
export const SQLSeasonTable = `
    create table if not exists SeasonTable(
        season_id       text not null primary key,
        display_name    text,
        start_date      text not null,
        end_date        text not null,
        uma1            integer not null,
        uma2            integer not null,
        uma3            integer not null,
        uma4            integer not null,
        oka             integer not null
    )`

export interface ParticipantEntry {
    game_id: string;
    player_id: string;
    raw_score: number;
    adj_score: number;
    placement: number;
}

export const SQLParticipantTable = `
    create table if not exists ParticipantTable (
        game_id     text not null,
        player_id   text not null,
        raw_score   integer not null,
        adj_score   integer not null,
        placement   integer not null,

        primary key (game_id, player_id),
        foreign key (game_id) references GameTable(game_id) on delete cascade
    )`

export interface ConfigTable {
    current_season: string;
};
export const SQLConfigTable = `
    create table if not exists ConfigTable (
        key     text not null primary key,
        value   text
    )`