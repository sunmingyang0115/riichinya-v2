import { RiichiDatabase } from "./modules/riichidb/sql_db2";



async function tests() {

    await RiichiDatabase.addSeason({
    "display_name": "Spring26",
    "start_date": "1234",
    "end_date": "4256",
    "season_id": "S26",
    "target": 25000,
    "uma1": 10000,
    "uma2": 5000,
    "uma3": -5000,
    "uma4": -10000,
    "oka": 0,
    })

    console.log(await RiichiDatabase.getSeason("S26"))

    await RiichiDatabase.addGame({
        "date": "1-1-1",
        "game_id": "G402",
        "notes": "",
        "season_id": "S26"
    })

    await RiichiDatabase.addParticipant({
        "game_id": "G402",
        "placement": 0,
        "player_id": "1",
        "raw_score": 30000,
        "adj_score": 15000
    })
    await RiichiDatabase.addParticipant({
        "game_id": "G402",
        "placement": 1,
        "player_id": "2",
        "raw_score": 25000,
        "adj_score": 5000
    })
     await RiichiDatabase.addParticipant({
        "game_id": "G402",
        "placement": 2,
        "player_id": "3",
        "raw_score": 24000,
        "adj_score": -6000
    })
     await RiichiDatabase.addParticipant({
        "game_id": "G402",
        "placement": 3,
        "player_id": "4",
        "raw_score": 21000,
        "adj_score": -14000
    })

    console.log(await RiichiDatabase.getLeaderboard(0, 10, "S26"))
    console.log(await RiichiDatabase.getRecentGames(0, 10, "S26", "1"))
    console.log(await RiichiDatabase.getPlayerProfile("S26", "1"))
    console.log(await RiichiDatabase.getOpponentDelta(0, 10, "S26", "1"))
}

if (require.main === module) { void tests(); }