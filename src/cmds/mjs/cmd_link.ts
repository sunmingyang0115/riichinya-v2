import { EmbedBuilder, Message } from "discord.js";
import { UsersDatabase } from "./sql_db";
import { getAmaeIdFromNickname } from "./amae_api";
import { amaeUrl, MJS_ERROR_TYPE, MjsError } from "./common";

/**
 * Associates Majsoul Nickname and Amae id with Discord User.
 * Looks up nickname on Amae server to check if Amae id matches nickname.
 *
 * @param discordId
 * @param mjsNickname
 * @param amaeId
 * @returns provided amaeId
 */
const linkDiscordMjsAmae = async (
  discordId: string,
  mjsNickname: string,
  amaeId: string
): Promise<string> => {
  const amaeIds = await getAmaeIdFromNickname(mjsNickname);
  if (!amaeIds.includes(amaeId)) {
    throw {
      mjsErrorType: MJS_ERROR_TYPE.NICK_AMAE_MISMATCH,
    };
  }
  await UsersDatabase.setUser(discordId, mjsNickname, amaeId);
  return amaeId;
};

/**
 * Gets Majsoul Nickname associated with discordId.
 *
 * If none, return empty string.
 *
 * @param discordId
 * @returns associated username or empty string
 */
const getMjsNickname = async (discordId: string): Promise<string> => {
  const response = await UsersDatabase.getUser(discordId);
  return response?.mjsNickname ?? "";
};

/**
 * Handles all functionality related to linking a discord user with a majsoul account.
 *
 * Returns string to place inside embed.
 *
 * @param event Discord bot message event
 * @param args Arguments passed to the link command
 * @returns
 */
export const linkHandler = async (
  event: Message<boolean>,
  args: string[],
  embed: EmbedBuilder
): Promise<string> => {
  const { author: discordAuthor } = event;
  const savedMjsNickname = await getMjsNickname(discordAuthor.id);
  const nicknameToSet = args?.[0] ?? "";
  let amaeId: string;
  try {
    if (args.length === 0) {
      return savedMjsNickname
        ? `<@${discordAuthor.id}> is linked to \`${savedMjsNickname}\``
        : "Majsoul username not set, use `ron mjs link <username>` to link username.";
    } else if (args.length === 1) {
      const nicknameToSet = args[0];
      amaeId = await getAmaeIdFromNickname(nicknameToSet);
      await UsersDatabase.setUser(discordAuthor.id, nicknameToSet, amaeId);
    } else if (args.length === 2) {
      const nicknameToSet = args[0];
      amaeId = args[1];
      await linkDiscordMjsAmae(discordAuthor.id, nicknameToSet, amaeId);
    } else {
      return "Too many arguments: expected 0 or 1 arguments.";
    }
    return `Successfully linked <@${discordAuthor.id}> to \`${nicknameToSet}\`, with amae-koromo id https://amae-koromo.sapk.ch/player/${amaeId}`;
  } catch (e: any) {
    if (!e.hasOwnProperty("mjsErrorType")) {
      throw e;
    }
    switch (e.mjsErrorType) {
      case MJS_ERROR_TYPE.MULTIPLE_MATCHING_USERS:
        const ids = e.data.map(
          (id: string) => `- id ${id}: ${amaeUrl(id)}`
        );
        return `Multiple players found with username \`${nicknameToSet}\`. Which one are you?\n${ids.join(
          "\n"
        )}\nPlease retry with \`ron mjs link ${nicknameToSet} <id>\``;

      case MJS_ERROR_TYPE.NO_MATCHING_USERS:
        return `No players found with username ${nicknameToSet}`;

      default:
        throw e;
    }
  }
};
