import { SeasonEntry } from "./db_struct";


// changed GameInfo to AOS to simplify code
export type GameInfoEntry = {
	id: string;
    placement: number,
	scoreRaw: number;
	scoreAdj: number;
};
export type GameInfo = GameInfoEntry[]

export function parseScoreFromRaw(args : string[], season: SeasonEntry) : GameInfo {
    if (args.length != 8) {
        console.log(args)
        throw new Error("Raw Score incorrect length!");
    }
    for (let i = 0; i < args.length; i++) {
        if (Number.isNaN(Number(args[i]))) {
            throw new Error("Raw Score format error!");
        }
    }
    const uma = [ season.uma1, season.uma2, season.uma3, season.uma4 ]

    let players = 
       [{ id: args[0], score: Number(args[1]), adj: Number(args[1]), placement: 0, uma: 0 },
        { id: args[2], score: Number(args[3]), adj: Number(args[3]), placement: 0, uma: 0 },
        { id: args[4], score: Number(args[5]), adj: Number(args[5]), placement: 0, uma: 0 },
        { id: args[6], score: Number(args[7]), adj: Number(args[7]), placement: 0, uma: 0 }];
    
    let sum = players.reduce((acc, cur) => acc + cur.score, 0);
    // I could allow people to input scores like 25.6, but nahh
    if (sum == season.target * 4 / 1000) {
        // if the sum is 100, adjust scores to match 100000
        players.forEach(player => {
            player.score *= 1000;
            player.adj *= 1000;
        });
    }
    else if (sum != season.target * 4) {
        throw new Error(`Raw Score sum must be **100000** or **100**! Current sum: **${sum}**`);
    }

    // sort players by score descending
    players.sort((a, b) => b.score - a.score);
    // fill placement and uma
    players.forEach((p, i) => {
        players[i].placement = i + 1;
        players[i].uma = uma[i];
    });
    const grouped = Map.groupBy(players, p => p.score);
    grouped.forEach((v, k) => {
        // find average uma
        const umasToAlloc = v.reduce((acc, e) => acc + e.uma, 0);
        const umasAllocated = umasToAlloc / v.length;

        // find smallest placement
        const placement = v.reduce((acc, e) => acc > e.placement? e.placement: acc, v[0].placement);

        // set this to each element
        v.forEach((e, i, arr) => {
            arr[i].uma = umasAllocated;
            arr[i].placement = placement;
        })
    })
    // unflatten
    players = Array.from(grouped.values()).flat();
    console.log(players)


    // subtract starting score from adjusted scores
    players.forEach((player, i) => {
        players[i].adj = player.adj - season.target + season.oka + player.uma;
    });


    let gameInfo: GameInfo = players.map(p => ({
        "id": p.id,
        "scoreRaw": p.score,
        "scoreAdj": p.adj,
        "placement": p.placement
    }))

    return gameInfo;
}
