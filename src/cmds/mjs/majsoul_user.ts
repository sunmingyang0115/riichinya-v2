import dayjs, { unix } from "dayjs";
import {
  getExtendedPlayerStats,
  getPlayerRecords,
  getPlayerStats,
} from "./amae_api";
import {
  ALL_MODES,
  formatFixed1,
  MJS_MODE,
  PlayerExtendedStatsResponse,
  PlayerStatsResponse,
  Result,
} from "./common";
import { MAJOR_RANK, Rank } from "./rank";

export class MajsoulUser {
  amaeId: string;
  mjsNickname = "";
  defaultMode?: MJS_MODE;
  recentResults?: Result[];
  rank?: Rank;
  rankLastWeek?: Rank;
  playerStats: { [modeStr: string]: PlayerStatsResponse } = {};
  extendedStats: { [modeStr: string]: PlayerExtendedStatsResponse } = {};
  constructor(amaeId: string) {
    this.amaeId = amaeId;
  }

  /*
  Random notes:

  General procedure to fetch a player's stats:
  - if we want to use time/limit to filter, use /player_records/<player_id>/start/end?limit=&mode=&descending=true
    - this gets us all the games played by limit, and we can get their timestamps
  - make request to /player_stats/<player_id>/<start_timestamp>/<end_timestamp>?mode=16.12.9.15.11.8 (all modes)
    - start and end are determined above via /player_records
    - this gets all the played modes. maybe this stat is worth caching in our database?
  - make request to /player_extended_stats/<player_id>/<start_timestamp>/<end_timestamp>?mode=<mode>
    - this should be the very last request made.
  */

  /**
   * Get the rank point 1 week ago to calculate delta
   * @returns
   */
  async getRankOneWeekAgo() {
    const endDate = dayjs().subtract(1, "week");
    const startDate = endDate.subtract(4, "week");
    try {
      const playerStats = await getPlayerStats(
        this.amaeId,
        startDate,
        endDate,
        ALL_MODES
      );
      this.rankLastWeek = new Rank(
        playerStats.level.id,
        playerStats.level.score,
        playerStats.level.delta
      );

      return this;
    } catch (e) {
      // no games played between 1 week ago and 5 weeks ago.
      // API will return an error if this is the case, so we should swallow the error here.
      console.error(
        `No games played recently for user ${this.amaeId}- no delta.`
      );
      return this;
    }
  }

  getRankChange() {
    if (!this.rankLastWeek || !this.rank) return 0;
    const cmp = this.rank.subtract(this.rankLastWeek);
    if (Math.abs(cmp) >= 10000) {
      return cmp > 0 ? 1 : -1;
    } else {
      return 0;
    }
  }

  getRankDeltaEmoji() {
    const emojiLoookup = {
      [1]: "↑",
      [-1]: "↓",
      [0]: "",
    };
    return emojiLoookup[this.getRankChange()];
  }

  getPtDelta() {
    if (!this.rankLastWeek || !this.rank) return 0;
    const cmp = this.rank.subtract(this.rankLastWeek);
    if (cmp === 0) {
      return 0;
    } else if (cmp >= 10000) {
      // THIS CODE IS WRONG IF USER UPGRADES MORE THAN ONE RANK LOL
      return (
        this.rank.points -
        this.rank.getUpgradePts() / 2 +
        this.rankLastWeek.getUpgradePts() -
        this.rankLastWeek.points
      );
    } else if (cmp <= -10000) {
      return (
        this.rank.points -
        this.rank.getUpgradePts() / 2 -
        this.rankLastWeek.points
      );
    } else {
      return this.rank.points - this.rankLastWeek.points;
    }
  }

  getPtDeltaStr() {
    const delta = this.getPtDelta();
    if (delta === 0) return "+0";
    return `${delta > 0 ? "+" : ""}${this.rank?.majorRank === MAJOR_RANK.Cl ? formatFixed1(delta / 100) : delta.toString()}`;
  }

  /**
   * Get all the stats and save them (mostly) as class properties.
   * @param limit
   * @param modes
   * @returns
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
        playerRecords[Math.min(limit, playerRecords.length - 1)];
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

    const last20Games = await getPlayerRecords(
      this.amaeId,
      undefined,
      undefined,
      (modes = modes),
      (limit = 20)
    );

    this.recentResults = last20Games
      .map((game) => {
        // sort scores in descending order
        const scores = game.players
          .map((player) => player.score)
          .sort((a, b) => b - a);

        const playerScore = game.players.find(
          (player) => player.accountId.toString() === this.amaeId
        )!.score;

        let rank = 0;

        // lmao
        for (const score of scores) {
          if (playerScore === score) {
            break;
          }
          rank += 1;
        }

        if (rank < 0 || rank > 3) {
          throw TypeError("Result must be between 0 and 3 inclusive.");
        }

        return rank as Result;
      })
      .reverse();

    this.rank = new Rank(
      playerStats.level.id,
      playerStats.level.score,
      playerStats.level.delta
    );

    await this.getRankOneWeekAgo();

    this.defaultMode = Math.max(...playedModes);
    return {
      playerStats: playerStats,
      playerExtendedStats: playerExtendedStats,
    };
  }

  /**
   * Fetch the light stats, only the ones required to generate a simple leaderboard.
   * Regrettably, there is no deal-in rate or win rate found in the simple Player stats API.
   *
   * @returns
   */
  async fetchLightStats() {
    const playerStats = await getPlayerStats(
      this.amaeId,
      undefined,
      undefined,
      undefined
    );
    this.mjsNickname = playerStats.nickname;
    this.rank = new Rank(
      playerStats.level.id,
      playerStats.level.score,
      playerStats.level.delta
    );

    await this.getRankOneWeekAgo();

    return this;
  }
}
