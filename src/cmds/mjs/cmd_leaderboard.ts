import { codeBlock, EmbedBuilder, Message } from "discord.js";
import { MjsDatabase } from "./sql_db";
import { getAmaeIdFromNickname } from "./amae_api";
import { MJS_ERROR_TYPE, MjsError } from "./common";
import { AsciiTable3 } from "ascii-table3";
import { MajsoulUser } from "./majsoul_user";
import { Rank } from "./rank";

/**
 *
 * @param event Discord bot message event
 * @param args Arguments passed to the command.
 * @returns
 */
export const leaderboardHandler = async (
  event: Message<boolean>,
  args: string[],
  embed: EmbedBuilder
): Promise<string | undefined> => {
  try {
    const linkedAccounts = await MjsDatabase.getAllUsers();

    console.log(linkedAccounts);

    // Can be extended if needed to provide more sort options
    const sortOptions = {
      points: {
        name: "Rank Points",
        cmp: (a: MajsoulUser, b: MajsoulUser) => {
          if (!a.rank || !b.rank) {
            throw MJS_ERROR_TYPE.DATA_ERROR;
          }
          return b.rank.subtract(a.rank);
        },
      },
      delta: {
        name: "Rank/Point Change (1-week)",
        cmp: (a: MajsoulUser, b: MajsoulUser) => {
          return (
            b.getRankChange() * 10000 +
            b.getPtDelta() -
            (a.getRankChange() * 10000 + a.getPtDelta())
          );
        },
      },
    };

    let sortKey: keyof typeof sortOptions = "points";

    if (args[0] && args[0].trim().toLowerCase().includes("--sort-by=")) {
      const key = args[0].trim().toLowerCase().replace("--sort-by=", "");
      if (!Object.keys(sortOptions).includes(key)) {
        throw "Unrecognized sort key.";
      }
      sortKey = key as keyof typeof sortOptions;
    }
    
    const promises = linkedAccounts.map((user) => {
      const majsoulUser = new MajsoulUser(user.amaeId);
      return majsoulUser.fetchLightStats();
    });

    // Fetch user data in parallel to save time
    const majsoulUsers = await Promise.all(promises);

    const table = new AsciiTable3()
      .setHeading("", "Name", "Points", "Delta (1wk)")
      .addRowMatrix(
        majsoulUsers
          .sort(sortOptions[sortKey].cmp)
          .map((user, index) => {
            if (!user.rank) {
              throw MJS_ERROR_TYPE.DATA_ERROR;
            }
            const rankUpgradeStr = user.getRankDeltaEmoji();
            return [
              index + 1,
              `[${rankUpgradeStr}${user.rank.rankToShortString()}] ${
                user.mjsNickname
              }`,
              user.rank.ptsToString(),
              user.getPtDeltaStr(),
            ];
          })
      )
      .setStyle("unicode-round");

    embed.setTitle(`Server Leaderboard Sorted by ${sortOptions[sortKey].name}`);
    embed.setDescription(codeBlock(table.toString()));
  } catch (e: any) {
    console.error(e);
    throw e;
  }
  event.reply({
    embeds: [embed],
  });

  return "";
};
