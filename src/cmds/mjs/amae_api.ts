import axios, { AxiosError } from "axios";
import { MJS_ERROR_TYPE, MjsError, SearchPlayerResponse } from "./common";
import dayjs from "dayjs";

const API_ROOT = "https://5-data.amae-koromo.com/api/v2/pl4";

/**
 * Wrapper for fetching data from the amae koromo servers.
 *
 * @param path
 * @returns generic response type
 */
const amaeGet = async <T>(path: string): Promise<T> => {
  try {
    const response = await axios.get(`${API_ROOT}/${path}`);
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
export const getAmaeIds = async (mjsNickname: string): Promise<string[]> => {
  const response = await amaeGet<SearchPlayerResponse[]>(
    `search_player/${mjsNickname}`
  );

  const matchingIds = response
    .filter(
      (player) => player.nickname.toLowerCase() === mjsNickname.toLowerCase()
    )
    .map((player) => player.id.toString());

  return matchingIds;
};

export const getPlayerRecords = async (
  amaeId: string,
  startTimestamp = dayjs(new Date(2015, 1, 1)),
  endTimestamp = dayjs(),
  limit: number,
  modes: [16, 12, 9]
) => {
  const response = await amaeGet<
};
