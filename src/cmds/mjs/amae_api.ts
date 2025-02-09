import axios, { AxiosError } from "axios";
import {
  ALL_MODES,
  MJS_ERROR_TYPE,
  MJS_MODE,
  MjsError,
  PlayerExtendedStatsResponse,
  PlayerRecordResponse,
  PlayerStatsResponse,
  SearchPlayerResponse,
} from "./common";
import dayjs, { Dayjs } from "dayjs";
import TTLCache from "@isaacs/ttlcache";

const API_ROOT = "https://5-data.amae-koromo.com/api/v2/pl4";

// Cache with 5 minutes TTL
// TODO: put this in amaeGet below
// not implemented yet
const cache = new TTLCache({ max: 1000, ttl: 1000 * 60 * 10 });

/**
 * Rounds upwards dayjs timestamps to nearest 10 minutes, for cache key purposes.
 * If we used the real timestamp in the cache, it would never work since every API call is done at a different time.
 *
 * Courtesy of https://github.com/iamkun/dayjs/issues/1619#issuecomment-983022487.
 * @param date
 * @returns
 */
const ceilNearest10Minutes = (date: Dayjs) => {
  const amount = 10;
  const unit = "minutes";
  return date.add(amount - (date.get("minutes") % amount), unit).startOf(unit).unix();
};

/**
 * Wrapper for fetching data from the amae koromo servers.
 *
 * @param path
 * @returns generic response type
 */
const amaeGet = async <T>(path: string, cacheKey = ""): Promise<T> => {
  try {
    if (cacheKey && cache.has(cacheKey)) {
      console.log("Using cache: ", cacheKey);
      const cacheContents = cache.get<T>(cacheKey);
      return cacheContents!;
    }
    console.log("Making request to: ", path);
    const response = await axios.get(`${API_ROOT}/${path}`);
    if (cacheKey) {
      cache.set(cacheKey, response.data);
    }
    return response.data;
  } catch (e) {
    throw (e as AxiosError).toJSON();
  }
};

/**
 * Returns all amae ids matching provided majsoul nickname
 *
 * @param mjsNickname
 * @returns
 */
export const getAmaeIdFromNickname = async (
  mjsNickname: string
): Promise<string> => {
  const response = await amaeGet<SearchPlayerResponse[]>(
    `search_player/${mjsNickname}`,
    `search_player/${mjsNickname}`
  );

  const matchingIds = response
    .filter(
      (player) => player.nickname.toLowerCase() === mjsNickname.toLowerCase()
    )
    .map((player) => player.id.toString());

  if (matchingIds.length > 1) {
    throw {
      mjsErrorType: MJS_ERROR_TYPE.MULTIPLE_MATCHING_USERS,
      data: matchingIds,
    } as MjsError;
  }
  if (matchingIds.length === 0) {
    throw {
      mjsErrorType: MJS_ERROR_TYPE.NO_MATCHING_USERS,
    };
  }
  return matchingIds[0];
};

export const getPlayerRecords = async (
  amaeId: string,
  startTimestamp = dayjs(new Date(2015, 1, 1)),
  endTimestamp = dayjs(),
  modes = ALL_MODES,
  limit?: number
): Promise<PlayerRecordResponse[]> => {
  const modeStr = modes.join(".");
  const limitStr = limit ? `&limit=${limit}` : "";
  const response = await amaeGet<PlayerRecordResponse[]>(
    `player_records/${amaeId}/${endTimestamp.unix() * 1000}/${
      startTimestamp.unix() * 1000
    }/?mode=${modeStr}${limitStr}&descending=true`,
    `player_records/${amaeId}/${ceilNearest10Minutes(
      startTimestamp
    )}/${ceilNearest10Minutes(endTimestamp)}/${modeStr}/${limitStr}`
  );
  return response;
};

export const getPlayerStats = async (
  amaeId: string,
  startTimestamp = dayjs(new Date(2015, 1, 1)),
  endTimestamp = dayjs(),
  modes = ALL_MODES
): Promise<PlayerStatsResponse> => {
  const modeStr = modes.join(".");
  const response = await amaeGet<PlayerStatsResponse>(
    `player_stats/${amaeId}/${startTimestamp.unix() * 1000}/${
      endTimestamp.unix() * 1000
    }/?mode=${modeStr}`,
    `player_stats/${amaeId}/${ceilNearest10Minutes(
      startTimestamp
    )}/${ceilNearest10Minutes(endTimestamp)}/${modeStr}`
  );
  return response;
};

export const getExtendedPlayerStats = async (
  amaeId: string,
  startTimestamp = dayjs(new Date(2015, 1, 1)),
  endTimestamp = dayjs(),
  modes = ALL_MODES
): Promise<PlayerExtendedStatsResponse> => {
  const modeStr = modes.join(".");
  const response = await amaeGet<PlayerExtendedStatsResponse>(
    `player_extended_stats/${amaeId}/${startTimestamp.unix() * 1000}/${
      endTimestamp.unix() * 1000
    }/?mode=${modeStr}`,
    `player_extended_stats/${amaeId}/${ceilNearest10Minutes(
      startTimestamp
    )}/${ceilNearest10Minutes(endTimestamp)}/${modeStr}`
  );
  return response;
};
