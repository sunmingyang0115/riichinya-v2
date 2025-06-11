import { assert } from "console";
import { GameInfo } from "./sql_db";
const starting_score = 25000;
const uma = [15, 5, -5, -15];

//Add oka implementation if needed

/**
     * parses raw spliced strings of user ids and scores into a sorted GameInfo
     * @param args takes a string array in the format of [id1 value1 id2 ... id4 value4], with id as string, value as number
     * @returns GameInfo in the form [{id1, adjvalue1}, ... {id4, adjvalue4}] sorted by DESC adjvalue
     * 
     * @see adjustScoreAndSort for uma adjustment
     * @see formatScores for score formatting (17.3 -> 17000)
     */
export function parseScoreFromRaw(args : string[]) : GameInfo {
    if (args.length != 8) {
        console.log(args)
        throw new Error("Raw Score incorrect length!");
    }
    for (let i = 0; i < args.length; i++) {
        if (Number.isNaN(Number(args[i]))) {
            throw new Error("Raw Score format error!");
        }
    }

    let players = [{ id: args[0], score: Number(args[1]), adj: Number(args[1]) },
        { id: args[2], score: Number(args[3]), adj: Number(args[3]) },
        { id: args[4], score: Number(args[5]), adj: Number(args[5]) },
        { id: args[6], score: Number(args[7]), adj: Number(args[7]) }];
    
    let sum = players.reduce((acc, cur) => acc + cur.score, 0);
    // I could allow people to input scores like 25.6, but nahh
    if (sum == starting_score * 4 / 1000) {
        // if the sum is 100, adjust scores to match 100000
        players.forEach(player => {
            player.score *= 1000;
            player.adj *= 1000;
        });
    }
    else if (sum != starting_score * 4) {
        throw new Error(`Raw Score sum must be **100000** or **100**! Current sum: **${sum}**`);
    }

    // sort players by score descending
    players.sort((a, b) => b.score - a.score);

    //allocating uma, splitting if needed (big brain technique used ngl)
    for (let i = 0; i < players.length; i++) {
        let currentUma = uma[i];
        let tiedCount = 1
        for (let j=i+1; j < players.length;j++) {
            if (players[j].score == players[i].score) {
                currentUma += uma[j];
                tiedCount++;
            } else {
                break;
            }
        }
        for (let j=0; j < tiedCount; j++) {
            players[i + j].adj += (currentUma * 1000) / tiedCount;
        }
        i += tiedCount - 1; // skip over tied players
    }

    // subtract starting score from adjusted scores
    players.forEach(player => {
        player.adj -= starting_score;
    });

    let gameInfo : GameInfo = {
        id: players.map(p => p.id),
        scoreRaw: players.map(p => p.score),
        scoreAdj: players.map(p => p.adj)
    }

    return gameInfo;
}
