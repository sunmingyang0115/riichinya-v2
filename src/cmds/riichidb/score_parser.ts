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
    let parsed : GameInfo = [];
    for (let i = 0; i < args.length; i+=2) {
        parsed.push({id: args[i], value: Number(args[i+1])});
    }
    formatScores(parsed);
    adjustScoreAndSort(parsed);
    return parsed;
}

/**
 * formats scores into 'thousand' notation (mangan is 8000 not 8.0)
 * if score is represented as 'decimal' notation, will be converted to 'thousand' (8.0 => 8000)
 * @param parsed unadjusted GameInfo with unformatted scores @see parseScoreFromRaw 
 * @returns GameInfo with unsorted and formatted scores with no uma @see adjustScoreAndSort
 */
function formatScores(parsed : GameInfo) : GameInfo {
    let sum = parsed.reduce((acc, cur) => acc + cur.value, 0);
    if (sum <= 100) {    // 48.0 2.0 25.0 25.0
        parsed.map((e, i) => parsed[i].value = Math.round(1000*e.value));
    }else {             // 48000 2000 25000 25000
        parsed.map((e, i) => parsed[i].value = Math.round(e.value));
    }
    return parsed;
    // 480 20 250 250
}

/**
 * does end score adjustment * 1000 (we do this to mitigate fp-errors)
 * adjustment calculation:
 *      End score = End points - Starting + 1000 * Uma
 * @param parsed the GameInfo with unadjusted and formatted scores @see formatScores
 * @returns GameInfo that is adjusted and formatted
 */
function adjustScoreAndSort(parsed : GameInfo) {
    parsed.sort((a, b) => b.value - a.value);
    
    console.log(parsed);
    parsed.map((e, i) => parsed[i].value = e.value + 1000 * uma[i] - starting_score);
    console.log(parsed);
    return parsed;
}