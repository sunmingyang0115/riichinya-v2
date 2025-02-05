import * as data from "./translate.json";

export enum MJS_ERROR_TYPE {
  MULTIPLE_MATCHING_USERS,
  NO_MATCHING_USERS,
  NICK_AMAE_MISMATCH,
}

export type MjsError = {
  mjsErrorType: MJS_ERROR_TYPE;
  data?: any;
};

export enum MJS_LOBBY {
  GOLD_EAST = 8,
  GOLD_HANCHAN = 9,
  JADE_EAST = 11,
  JADE_HANCHAN = 12,
  THRONE_EAST = 15,
  THRONE_HANCHAN = 16,
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
  played_modes: number[];
};

export type PlayerRecordResponse = {
  _id: string,
  modeId: number,
  uuid: string,
  startTime: number,
  endTime: number,
  players: {
    accountId: number,
    nickname: string,
    level: number,
    score: number,
    gradingScore: number
  }[]
}

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

// Gotta figure out how to type this
export const t = (jpName: string): string => {
  return data[jpName];
}
