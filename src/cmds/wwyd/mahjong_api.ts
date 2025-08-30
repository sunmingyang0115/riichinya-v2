import axios from "axios";

const API_URL = "https://pystyle.info/apps/mahjong-cpp_0.9.1/post.py";

// Types for WWYD data structure
export type Wwyd = {
	seat: "E" | "S" | "W" | "N";
	round: "E" | "S";
	turn: string;
	indicator: string;
	hand: string[];
	draw: string;
	answer: string;
	comment: (string | string[])[];
};

// Types for the pystyle request
export interface MahjongAnalysisRequest {
	enable_reddora: boolean;
	enable_uradora: boolean;
	enable_shanten_down: boolean;
	enable_tegawari: boolean;
	enable_riichi: boolean;
	round_wind: number;
	dora_indicators: number[];
	hand: number[];
	melds: any[];
	seat_wind: number;
	wall: number[];
	version: string;
}

export interface MahjongAnalysisResponse {
	success: boolean;
	request: MahjongAnalysisRequest & {
		ip?: string;
	};
	response: {
		shanten: {
			all: number;
			regular: number;
			seven_pairs: number;
			thirteen_orphans: number;
		};
		stats: Array<{
			tile: number;
			tenpai_prob: number[];
			win_prob: number[];
			exp_score: number[];
			necessary_tiles: Array<{
				tile: number;
				count: number;
			}>;
			shanten: number;
		}>;
		searched: number;
		time: number;
		config: {
			t_min: number;
			t_max: number;
			sum: number;
			extra: number;
			shanten_type: number;
			calc_stats: boolean;
			num_tiles: number;
		};
	};
    err_msg?: string,
}

/**
 * Convert tile notation from string format (e.g., "1m", "5p", "7s", "1z") to numeric format
 * @param tile - Tile in string format
 * @returns Numeric representation of the tile (0-36)
 */
function convertTileToNumber(tile: string): number {
	// Valid check
	if (!/^[0-9][mpsz]$/.test(tile)) {
		throw new Error(`Invalid tile format: ${tile}`);
	}

	//Aka tiles
	if (tile === "0m") return 34;
	if (tile === "0p") return 35;
	if (tile === "0s") return 36;

	const suitDelta: Record<string, number> = { m: -1, p: 8, s: 17, z: 26 };

	return parseInt(tile[0]) + suitDelta[tile[1]];
}

function convertNumberToTile(tile: number): string {
    if (tile < 0 || tile > 36) {
        throw new Error(`Invalid tile number: ${tile}`);
    }

    //Aka tiles
    if (tile === 34) return "0m";
    if (tile === 35) return "0p";
    if (tile === 36) return "0s";

    if (tile < 9) {
        return `${tile + 1}m`
    } else if (tile < 18) {
        return `${tile - 8}p`
    } else if (tile < 27) {
        return `${tile - 17}s`
    } else if (tile < 34) {
        return `${tile - 26}z`
    }

    throw new Error(`Invalid tile number: ${tile}`);
}

// Generates the remaining wall. Tiles should include dora indicators
function generateWall(tiles: number[]): number[] {
	const wall = new Array(37).fill(4);
	//red five separation
	wall[34] = wall[35] = wall[36] = 1;
    // the regular 5 counts are used as the total 5 counts

	// Subtract used tiles
	for (const tile of tiles) {
		if (tile < wall.length && wall[tile] > 0) {
			wall[tile]--;
		}
        //if red fives, also subtract from regular 5
        if (tile === 34) wall[4]--;
        if (tile === 35) wall[13]--;
        if (tile === 36) wall[22]--;
	}

	return wall;
}

/**
 * Convert a Wwyd object to the format required by the mahjong analysis API
 * @param wwyd - WWYD problem data
 * @returns Request object for the mahjong analysis API
 */
export function convertWwydToApiFormat(wwyd: Wwyd): MahjongAnalysisRequest {
	// Convert hand tiles (13 tiles) and draw tile (1 tile) to numbers
	const handTiles = wwyd.hand.map(convertTileToNumber);
	const drawTile = convertTileToNumber(wwyd.draw);
	const allHandTiles = [...handTiles, drawTile];

	// Convert dora indicator
	const doraIndicator = convertTileToNumber(wwyd.indicator);

	// Convert winds
	const roundWind = { E: 27, S: 28 }[wwyd.round];
	const seatWind = { E: 27, S: 28, W: 29, N: 30 }[wwyd.seat];
	const wall = generateWall([...allHandTiles, doraIndicator]);

	return {
		enable_reddora: true,
		enable_uradora: true,
		enable_shanten_down: true,
		enable_tegawari: true,
		enable_riichi: false,
		round_wind: roundWind,
		dora_indicators: [doraIndicator],
		hand: allHandTiles,
		melds: [],
		seat_wind: seatWind,
		wall: wall,
		version: "0.9.1",
	};
}

/**
 * Send a request to the mahjong analysis API
 * @param data The request payload in the API format
 * @returns Promise with the analysis results
 */
export async function getMahjongAnalysis(
	data: MahjongAnalysisRequest
): Promise<MahjongAnalysisResponse> {
	try {
		const response = await axios.post(API_URL, data, {
			headers: {
				"Content-Type": "application/json",
			},
			timeout: 2000,
		});

		return response.data;
	} catch (error) {
		if (axios.isAxiosError(error)) {
			if (error.response) {
				// Server responded with error status
				throw new Error(`API Error ${error.response.status}: ${error.response.data}`);
			} else if (error.request) {
				// Request was made but no response received
				throw new Error("No response from mahjong analysis API");
			} else {
				// Something else happened
				throw new Error(`Request error: ${error.message}`);
			}
		}
		throw error;
	}
}

export type WwydAnalysisResult = {
    tile: string;
    shanten: number;
    back: boolean;
    wait_count: number;
    wait_unique: number;
    wait_types: string[];
    value: number;
    winning: number;
    tenpai: number;
};

// Convert API response data to internal format, because it's really confusing
function convertResponseData(response: MahjongAnalysisResponse, turn: number): WwydAnalysisResult[] {
	// Convert back the tile numbers to their string representations
    const options = response.response.stats.map((stat) => {
        return {
            tile: convertNumberToTile(stat.tile),
            shanten: stat.shanten,
            back: stat.shanten > response.response.shanten.all,
            wait_count: stat.necessary_tiles.reduce((sum, wait) => sum + wait.count, 0),
            wait_unique: stat.necessary_tiles.length,
            wait_types: stat.necessary_tiles.map(wait => convertNumberToTile(wait.tile)),
            value: stat.exp_score[turn] || 0,
            winning: stat.win_prob[turn] || 0,
            tenpai: stat.tenpai_prob[turn] || 0
        };
    });

	return options
}

/**
 * Analyze a WWYD situation using the external API
 * @param wwyd - WWYD problem data
 * @returns Promise with the analysis results
 */
export async function analyzeWWYDSituation(wwyd: Wwyd): Promise<WwydAnalysisResult[]> {
	const apiData = convertWwydToApiFormat(wwyd);
	const response = await getMahjongAnalysis(apiData);
    if (response.success === true) {
        return convertResponseData(response, parseInt(wwyd.turn));
    } else {
        throw new Error(response.err_msg);
    }

	
}
