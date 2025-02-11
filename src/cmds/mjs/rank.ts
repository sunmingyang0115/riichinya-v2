/**
 * Everything related to MJS ranks go here in this file.
 */

import { ANSI_COLOR } from "./common";

// Amae servers should only need support for Expert and above.
export enum MAJOR_RANK {
  No = 1,
  Ad = 2,
  Ex = 3,
  Ms = 4,
  St = 5,
  Cl = 6,
}

export const majorRankLongNames = {
  [MAJOR_RANK.No]: "Novice",
  [MAJOR_RANK.Ad]: "Adept",
  [MAJOR_RANK.Ex]: "Expert",
  [MAJOR_RANK.Ms]: "Master",
  [MAJOR_RANK.St]: "Saint",
  [MAJOR_RANK.Cl]: "Celestial",
};

export const rankData: {
  [majorRank in MAJOR_RANK]: {
    [minorRank: number]: {
      upgradePts: number;
    };
  };
} = {
  [MAJOR_RANK.No]: {},
  [MAJOR_RANK.Ad]: {},
  [MAJOR_RANK.Ex]: {
    1: {
      upgradePts: 1200,
    },
    2: {
      upgradePts: 1400,
    },
    3: {
      upgradePts: 2000,
    },
  },
  [MAJOR_RANK.Ms]: {
    1: {
      upgradePts: 2800,
    },
    2: {
      upgradePts: 3200,
    },
    3: {
      upgradePts: 3600,
    },
  },
  [MAJOR_RANK.St]: {
    1: {
      upgradePts: 4000,
    },
    2: {
      upgradePts: 6000,
    },
    3: {
      upgradePts: 9000,
    },
  },
  [MAJOR_RANK.Cl]: {},
};

export class Rank {
  majorRank: MAJOR_RANK;
  minorRank: number; // 1-indexed. E.g. Expert 1, minorRank=1
  points: number;

  constructor(amaeRank: number, points: number, delta: number) {
    const majorRank = Math.floor(amaeRank / 100) % 10;
    const minorRank = amaeRank % 100;

    if (!Object.values(MAJOR_RANK).includes(majorRank)) {
      console.error(`Unknown rank: ${amaeRank}`);
      throw TypeError(`Unknown rank: ${amaeRank}`);
    }
    if (
      (majorRank as MAJOR_RANK) !== MAJOR_RANK.Cl &&
      !(minorRank <= 3 && minorRank >= 1)
    ) {
      console.error(`Unknown rank: ${amaeRank}`);
      throw TypeError(`Unknown rank: ${amaeRank}`);
    }

    // Celestial is defined as 7 on Amae servers, constrain it to max 6
    this.majorRank = Math.min(majorRank, 6) as MAJOR_RANK;
    this.minorRank = minorRank;
    this.points = points + delta;

    // Amae servers doesnt actually store the latest rank points, need to calculate it using points + delta.
    // We need to handle overflow, e.g. points=1350/1400 + delta=100 => 1450/1400.
    if (this.points >= this.getUpgradePts()) {
      this.minorRank += 1;
      if (this.majorRank !== MAJOR_RANK.Cl && this.minorRank > 3) {
        this.majorRank += 1;
        this.minorRank = 1;
      }
      this.points = this.getUpgradePts() / 2;
    }
  }
  getUpgradePts(): number {
    switch (this.majorRank) {
      case MAJOR_RANK.Ex:
      case MAJOR_RANK.Ms:
      case MAJOR_RANK.St:
        return rankData[this.majorRank][
          this.minorRank as keyof (typeof rankData)[MAJOR_RANK.Ex]
        ].upgradePts;

      case MAJOR_RANK.Cl:
        return 20;

      default:
        return 0;
    }
  }

  /**
   * If the ranks are the same, perform this.points - other.points
   *
   * If this rank is higher, return a large positive number > 9999
   * If this rank is lower, return a large negative number < 9999
   *
   * @param other Another rank to subtract
   */
  subtract(other: Rank) {
    const cmp =
      this.majorRank * 100 +
      this.minorRank -
      (other.majorRank * 100 + other.minorRank);

    return Math.abs(cmp) !== 0 ? cmp * 10000 : this.points - other.points;
  }

  // E.g. Expert 2
  rankToString(): string {
    return `${majorRankLongNames[this.majorRank]} ${this.minorRank}`;
  }

  // E.g. 1350/1400
  ptsToString(): string {
    return `${this.points}/${this.getUpgradePts()}`;
  }

  getAnsiColor(): ANSI_COLOR {
    const colors = {
      [MAJOR_RANK.No]: ANSI_COLOR.DEFAULT,
      [MAJOR_RANK.Ad]: ANSI_COLOR.DEFAULT,
      [MAJOR_RANK.Ex]: ANSI_COLOR.YELLOW,
      [MAJOR_RANK.Ms]: ANSI_COLOR.RED,
      [MAJOR_RANK.St]: ANSI_COLOR.PINK,
      [MAJOR_RANK.Cl]: ANSI_COLOR.BLUE,
    };
    return colors[this.majorRank];
  }

  // E.g. Ex2
  rankToShortString(): string {
    return `${MAJOR_RANK[this.majorRank]}${this.minorRank}`;
  }

  // TODO: Update this to be on the main repo, not a fork.
  getImage(): string {
    const ROOT_ASSETS_URL = `https://raw.githubusercontent.com/danielq987/riichinya-v2/refs/heads/main/assets`;
    return `${ROOT_ASSETS_URL}/${this.rankToShortString()}.png`;
  }
}
