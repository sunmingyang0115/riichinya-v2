import { unix } from "dayjs";
import {
  getExtendedPlayerStats,
  getPlayerRecords,
  getPlayerStats,
} from "./amae_api";
import {
  ALL_MODES,
  MJS_MODE,
  PlayerExtendedStatsResponse,
  PlayerStatsResponse,
  Rank,
} from "./common";

export class MajsoulUser {
  amaeId: string;
  mjsNickname?: string;
  defaultMode?: MJS_MODE;
  rank?: Rank;
  playerStats: { [modeStr: string]: PlayerStatsResponse } = {};
  extendedStats: { [modeStr: string]: PlayerExtendedStatsResponse } = {};
  constructor(amaeId: string) {
    this.amaeId = amaeId;
  }

  /*
  General procedure to fetch a player's stats:
  - if we want to use time/limit to filter, use /player_records/<player_id>/start/end?limit=&mode=&descending=true
    - this gets us all the games played by limit, and we can get their timestamps
  - make request to /player_stats/<player_id>/<start_timestamp>/<end_timestamp>?mode=16.12.9.15.11.8 (all modes)
    - start and end are determined above via /player_records
    - this gets all the played modes. maybe this stat is worth caching in our database?
  - make request to /player_extended_stats/<player_id>/<start_timestamp>/<end_timestamp>?mode=<mode>
    - this should be the very last request made.
  */

  async fetchLightStats() {
    const playerStats = await getPlayerStats(
      this.amaeId,
      undefined,
      undefined,
      undefined
    );
    this.rank = new Rank(playerStats.level.id, playerStats.level.score);
  }
  /*
   */
  async fetchFullStats(
    limit = 0,
    modes = ALL_MODES
  ): Promise<{
    playerStats: PlayerStatsResponse;
    playerExtendedStats: PlayerExtendedStatsResponse;
  }> {
    let oldestGameStart = undefined;
    if (limit) {
      const playerRecords = await getPlayerRecords(
        this.amaeId,
        undefined,
        undefined,
        (modes = modes),
        (limit = limit)
      );
      const oldestGame =
        playerRecords[Math.max(limit, playerRecords.length) - 1];
      oldestGameStart = unix(oldestGame.startTime);
    }
    const playerStats = await getPlayerStats(
      this.amaeId,
      oldestGameStart,
      undefined,
      (modes = modes)
    );
    const playedModes: MJS_MODE[] = playerStats.played_modes;
    const playerExtendedStats = await getExtendedPlayerStats(
      this.amaeId,
      oldestGameStart,
      undefined,
      playedModes
    );
    const playedModesStr = playedModes.join(",");

    this.rank = new Rank(playerStats.level.id, playerStats.level.score + playerStats.level.delta);
    this.defaultMode = Math.max(...playedModes);
    return {
      playerStats: playerStats,
      playerExtendedStats: playerExtendedStats,
    };
  }
}
