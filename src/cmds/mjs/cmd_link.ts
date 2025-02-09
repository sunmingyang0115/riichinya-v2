import { EmbedBuilder, inlineCode, Message } from "discord.js";
import { MjsDatabase } from "./sql_db";
import { getAmaeIdFromNickname } from "./amae_api";
import { amaeUrl, MJS_ERROR_TYPE } from "./common";

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
  try {
    const searchId = await getAmaeIdFromNickname(mjsNickname);
    if (amaeId !== searchId) {
      throw {
        mjsErrorType: MJS_ERROR_TYPE.NICK_AMAE_MISMATCH,
      };
    }
    await MjsDatabase.setUser(discordId, mjsNickname, amaeId);
    return amaeId;
  } catch (e: any) {
    if (e.mjsErrorType === MJS_ERROR_TYPE.MULTIPLE_MATCHING_USERS) {
      await MjsDatabase.setUser(discordId, mjsNickname, amaeId);
      return amaeId;
    } else {
      throw(e)
    }
  }
};

/**
 * Handles all functionality related to linking a discord user with a majsoul account.
 *
 * @param event Discord bot message event
 * @param args Arguments passed to the link command
 * @returns
 */
export const linkHandler = async (
  event: Message<boolean>,
  args: string[],
  embed: EmbedBuilder
): Promise<string | undefined> => {
  const { author: discordAuthor } = event;
  const savedMjsNickname = (await MjsDatabase.getUser(discordAuthor.id))
    ?.mjsNickname;
  const nicknameToSet = args?.[0] ?? "";
  let amaeId: string;
  let content;

  try {
    if (args.length === 0) {
      content = savedMjsNickname
        ? `<@${discordAuthor.id}> is linked to ${inlineCode(savedMjsNickname)}`
        : "Majsoul username not set, use `ron mjs link <username>` to link username.";
    } else if (args.length === 1) {
      const nicknameToSet = args[0];
      amaeId = await getAmaeIdFromNickname(nicknameToSet);
      await MjsDatabase.setUser(discordAuthor.id, nicknameToSet, amaeId);
      content = `Successfully linked <@${discordAuthor.id}> to ${inlineCode(nicknameToSet)}, with amae-koromo id https://amae-koromo.sapk.ch/player/${amaeId}`;
    } else if (args.length === 2) {
      const nicknameToSet = args[0];
      amaeId = args[1];
      await linkDiscordMjsAmae(discordAuthor.id, nicknameToSet, amaeId);
      content = `Successfully linked <@${discordAuthor.id}> to ${inlineCode(nicknameToSet)}, with amae-koromo id https://amae-koromo.sapk.ch/player/${amaeId}`;
    } else {
      throw MJS_ERROR_TYPE.ARGUMENT_ERROR;
    }
  } catch (e: any) {
    if (!e.hasOwnProperty("mjsErrorType")) {
      throw e;
    }
    switch (e.mjsErrorType) {
      case MJS_ERROR_TYPE.MULTIPLE_MATCHING_USERS:
        const ids = e.data.map((id: string) => `- id ${id}: ${amaeUrl(id)}`);
        return `Multiple players found with username ${inlineCode(nicknameToSet)}. Which one are you?\n${ids.join(
          "\n"
        )}\nPlease retry with \`ron mjs link ${nicknameToSet} <id>\``;

      case MJS_ERROR_TYPE.NO_MATCHING_USERS:
        return `No players found with username ${inlineCode(nicknameToSet)}`;

      case MJS_ERROR_TYPE.ARGUMENT_ERROR:
        return `Too many arguments, expected 0-2 arguments.`;

      default:
        throw e;
    }
  }

  embed.setDescription(content);

  event.reply({
    embeds: [embed],
  });

  return "";
};
