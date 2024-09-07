import { assert } from "console";
import { GameInfo } from "./sql_db";
const starting_score = 25000;
const uma = [15, 5, -5, -15];

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

    let idList = [args[0], args[2], args[4], args[6]]
    let scoreList = [Number(args[1]), Number(args[3]), Number(args[5]), Number(args[7])];
    formatScores(scoreList);

    let gameInfo = listToGameInfo(idList, scoreList);

    return gameInfo;
}

/**
 * formats scores into 'thousand' notation (mangan is 8000 not 8.0)
 * if score is represented as 'decimal' notation, will be converted to 'thousand' (8.0 => 8000)
 */
function formatScores(unparsedScore : Array<number>) {
    let sum = unparsedScore.reduce((acc, cur) => acc + cur, 0);
    if (sum <= 100) {
        unparsedScore.map((score, i) => unparsedScore[i] = Math.round(1000*score))
    } else {
        unparsedScore.map((score, i) => unparsedScore[i] = Math.round(score))
    }
}

// probably more elegant/efficient way but im low level enjoyer 
function getHighestScore(idList : Array<string>, scoreList: Array<number>) : number {
    assert(idList.length == scoreList.length, "id/score list length must match")
    let iHigh = 0;
    let scoreHigh = scoreList[0];
    for (let i = 1; i < idList.length; i++) {
        if (scoreHigh < scoreList[i]) {
            iHigh = i;
            scoreHigh = scoreList[i];
        }
    }
    return iHigh;
}

// converts idList and scoreList to gameInfo
function listToGameInfo(idList : Array<string>, scoreList: Array<number>) : GameInfo {
    // O(n^2) (but n is 4 so its fine)
    let gameInfo : GameInfo = {
        id: [],
        scoreRaw: [],
        scoreAdj: []
    };
    while (idList.length != 0) {
        let index = getHighestScore(idList, scoreList);
        gameInfo.id.push(idList[index]);
        gameInfo.scoreRaw.push(scoreList[index]);
        idList.splice(index, 1);
        scoreList.splice(index, 1);
    }
    // End points - Starting + 1000 * Uma
    for (let i = 0; i < gameInfo.scoreRaw.length; i++) {
        gameInfo.scoreAdj[i] = gameInfo.scoreRaw[i] - starting_score + 1000 * uma[i];
    }
    return gameInfo;
}

// /**
//  * does end score adjustment * 1000 (we do this to mitigate fp-errors)
//  * adjustment calculation:
//  *      End score = End points - Starting + 1000 * Uma
//  * @param parsed the GameInfo with unadjusted and formatted scores @see formatScores
//  * @returns GameInfo that is adjusted and formatted
//  */
// function adjustScoreAndSort(parsed : GameInfo) {
//     parsed.sort((a, b) => b.value - a.value);
    
//     console.log(parsed);
//     parsed.map((e, i) => parsed[i].value = e.value + 1000 * uma[i] - starting_score);
//     console.log(parsed);
//     return parsed;
// }