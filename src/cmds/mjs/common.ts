import { Dayjs } from "dayjs";
import * as data from "./translate.json";

export enum MJS_ERROR_TYPE {
  MULTIPLE_MATCHING_USERS,
  NO_MATCHING_USERS,
  NICK_AMAE_MISMATCH,
  NO_LINKED_USER,
}

export type MjsError = {
  mjsErrorType: MJS_ERROR_TYPE;
  data?: any;
};

export enum MJS_MODE {
  GOLD_EAST = 8,
  GOLD_HANCHAN = 9,
  JADE_EAST = 11,
  JADE_HANCHAN = 12,
  THRONE_EAST = 15,
  THRONE_HANCHAN = 16,
}

export const ALL_MODES = [
  MJS_MODE.GOLD_EAST,
  MJS_MODE.GOLD_HANCHAN,
  MJS_MODE.JADE_EAST,
  MJS_MODE.JADE_HANCHAN,
  MJS_MODE.THRONE_EAST,
  MJS_MODE.THRONE_HANCHAN,
];

export enum MAJOR_RANK {
  No = 1,
  Ad = 2,
  Ex = 3,
  Ms = 4,
  St = 5,
  Cl = 7,
}

const majorRankLongNames = {
  [MAJOR_RANK.No]: "Novice",
  [MAJOR_RANK.Ad]: "Adept",
  [MAJOR_RANK.Ex]: "Expert",
  [MAJOR_RANK.Ms]: "Master",
  [MAJOR_RANK.St]: "Saint",
  [MAJOR_RANK.Cl]: "Celestial",
};

const rankData = {
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
};

export class Rank {
  majorRank: MAJOR_RANK;
  minorRank: number;
  points: number;

  constructor(amaeRank: number, points: number) {
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
    this.majorRank = majorRank as MAJOR_RANK;
    this.minorRank = minorRank;
    this.points = points;
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

  static compare(a: Rank, b: Rank) {
    return a.majorRank * 100 + a.minorRank - (b.majorRank * 100 + b.minorRank);
  }

  rankToString(): string {
    return `${majorRankLongNames[this.majorRank]} ${this.minorRank}`;
  }

  ptsToString(): string {
    return `${this.points}/${this.getUpgradePts()}`;
  }

  rankToShortString(): string {
    return `${MAJOR_RANK[this.majorRank]}${this.minorRank}`;
  }
}

export type SearchPlayerResponse = {
  id: number;
  nickname: string;
  level: {
    id: number;
    score: number;
    delta: number;
  };
  latest_timestamp: number;
};

export type PlayerStatsResponse = {
  count: number;
  level: {
    id: number;
    score: number;
    delta: number;
  };
  max_level: {
    id: number;
    score: number;
    delta: 0;
  };
  rank_rates: number[];
  rank_avg_score: number[];
  avg_rank: number;
  negative_rate: number[];
  id: number;
  nickname: string;
  played_modes: MJS_MODE[];
};

export type PlayerRecordResponse = {
  _id: string;
  modeId: number;
  uuid: string;
  startTime: number;
  endTime: number;
  players: {
    accountId: number;
    nickname: string;
    level: number;
    score: number;
    gradingScore: number;
  }[];
};

export type PlayerExtendedStatsResponse = {
  count: number;
  和牌率: number;
  自摸率: number;
  默听率: number;
  放铳率: number;
  副露率: number;
  立直率: number;
  平均打点: number;
  最大连庄: number;
  和了巡数: number;
  平均铳点: number;
  流局率: number;
  流听率: number;
  一发率: number;
  里宝率: number;
  被炸率: number;
  平均被炸点数: number;
  放铳时立直率: number;
  放铳时副露率: number;
  立直后放铳率: number;
  立直后非瞬间放铳率: number;
  副露后放铳率: number;
  立直后和牌率: number;
  副露后和牌率: number;
  立直后流局率: number;
  副露后流局率: number;
  放铳至立直: number;
  放铳至副露: number;
  放铳至默听: number;
  立直和了: number;
  副露和了: number;
  默听和了: number;
  立直巡目: number;
  立直收支: number;
  立直收入: number;
  立直支出: number;
  先制率: number;
  追立率: number;
  被追率: number;
  振听立直率: number;
  立直好型: number;
  立直多面: number;
  立直好型2: number;
  役满: number;
  最大累计番数: number;
  W立直: number;
  打点效率: number;
  铳点损失: number;
  净打点效率: number;
  平均起手向听: number;
  平均起手向听亲: number;
  平均起手向听子: number;
  最近大铳: 最近大铳;
  id: number;
  played_modes: number[];
};

type 最近大铳 = {
  id: string;
  start_time: number;
  fans: Fan[];
};

type Fan = {
  id: number;
  label: string;
  count: number;
  役满: number;
};

export const t = (jpName: keyof typeof data): string => {
  return data[jpName];
};

export const formatPercent = (x: any) => {
  if (!x) {
    return "0%";
  }
  if (x < 0.0001) {
    return "<0.01%";
  }
  return `${(x * 100).toFixed(2)}%`;
};

export const formatFixed3 = (x: number) => x.toFixed(3);
export const formatRound = (x: number) => Math.round(x).toString();
export const formatIdentity = (x: number | string) => x.toString();

export const amaeUrl = (amaeId: string) =>
  `https://amae-koromo.sapk.ch/player/${amaeId}`;
