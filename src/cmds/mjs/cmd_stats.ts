import { EmbedBuilder, inlineCode, Message } from "discord.js";
import { UserIdData, MjsDatabase } from "./sql_db";
import {
  amaeUrl,
  formatFixed2,
  formatPercent,
  formatRound,
  MJS_ERROR_TYPE,
  PlayerExtendedStatsResponse,
  PlayerStatsResponse,
} from "./common";
import { MAJOR_RANK } from "./rank";
import { MajsoulUser } from "./majsoul_user";
import { getAmaeIdFromNickname } from "./amae_api";
import { generateCombinedSvg } from "./charts";
import sharp from "sharp";
import { parseArgs } from "util";

type StatConfig = {
  [key: string]: {
    label: string;
    value: number | string;
    formatter: (x: any) => string;
    cmp: (a: number, b: number) => number;
  };
};

/**
 * Stats come from either the playerStats API or extendedStats API
 * This function defines the stats we want to show and gets those values from the right source.
 *
 * @param playerStats
 * @param extendedStats
 * @returns
 */
const consolidateStats = (
  majsoulUser: MajsoulUser,
  playerStats: PlayerStatsResponse,
  extendedStats: PlayerExtendedStatsResponse
): StatConfig => {
  // Comparison functions: not used for anything right now, but indicates what order (asc/desc) to use when comparing a specific stat.
  const cmpHigh = (a: number, b: number) => b - a;
  const cmpLow = (a: number, b: number) => a - b;

  const { rank, rankLastWeek } = majsoulUser;

  let rankString = rank!.rankToShortString();
  let ptsString = rank!.ptsToString();

  if (rankLastWeek) {
    rankString += majsoulUser.getRankDeltaEmoji();
    ptsString += ` (${majsoulUser.getPtDeltaStr()})`;
  }

  const stats = {
    rank: {
      label: "Rank",
      value: inlineCode(rankString),
      formatter: (x: string) => x,
      cmp: cmpHigh,
    },
    points: {
      label: "Points",
      value: inlineCode(ptsString),
      formatter: (x: string) => x,
      cmp: cmpHigh,
    },
    recordedMatches: {
      label: "Games",
      value: playerStats.count,
      formatter: formatRound,
      cmp: cmpHigh,
    },
    dealInRate: {
      label: "Deal-in Rate",
      value: extendedStats["放铳率"],
      formatter: formatPercent,
      cmp: cmpLow,
    },
    winRate: {
      label: "Win Rate",
      value: extendedStats["和牌率"],
      formatter: formatPercent,
      cmp: cmpHigh,
    },
    callRate: {
      label: "Call Rate",
      value: extendedStats["副露率"],
      formatter: formatPercent,
      cmp: cmpHigh,
    },
    damaRate: {
      label: "Dama Rate",
      value: extendedStats["默听率"],
      formatter: formatPercent,
      cmp: cmpHigh,
    },
    averageRank: {
      label: "Average Placement",
      value: playerStats.avg_rank,
      formatter: formatFixed2,
      cmp: cmpLow,
    },
    uradoraRate: {
      label: "Uradora Rate",
      value: extendedStats["里宝率"],
      formatter: formatPercent,
      cmp: cmpHigh,
    },
  };
  return stats;
};

/**
 * Writes and formats all the stats into the Discord embed object.
 *
 * @param statsData
 * @param embed
 * @returns
 */
const displaySingleUserStats = (statsData: StatConfig, embed: EmbedBuilder) => {
  Object.entries(statsData).forEach(([k, v]) => {
    embed.addFields({
      name: v.label,
      value: inlineCode(v.formatter(v.value)),
      inline: true,
    })
  })

  return embed;
};

/**
 * Handler for the stats subcommand.
 *
 * @param event
 * @param args
 * @param embed
 * @returns
 */
export const statsHandler = async (
  event: Message<boolean>,
  args: string[],
  embed: EmbedBuilder
): Promise<string | undefined> => {
  const { author: discordAuthor } = event;
  const mjsNickname = args?.[0] ?? "";
  const files = [];
  try {
    let userData: UserIdData | null;

    const options = {
      limit: {
        type: "string" as const,
        short: "l",
      },
    };

    const { values: argValues, positionals: argPositionals } = parseArgs({
      args,
      options,
      allowPositionals: true,
    });

    if (argPositionals.length === 0) {
      userData = await MjsDatabase.getUser(discordAuthor.id);
    } else if (argPositionals.length === 1) {
      let amaeId: string;
      // This clause checks if the nickname entered is in id format (all digits)
      // If so, bypass the nickname lookup and straight up use arg[0] as amae id.
      if (mjsNickname.match(/^\d+$/g)) {
        amaeId = argPositionals[0];
      } else {
        amaeId = await getAmaeIdFromNickname(mjsNickname);
      }
      userData = {
        amaeId,
        mjsNickname,
        discordId: discordAuthor.id,
      };
    } else {
      return "Too many arguments: expected 0 or 1 positional arguments.";
    }

    let game_limit = 100;
    if (argValues.limit && !isNaN(parseInt(argValues.limit))) {
      game_limit = parseInt(argValues.limit);
    }

    if (!userData) {
      throw { mjsErrorType: MJS_ERROR_TYPE.NO_LINKED_USER };
    }

    const majsoulUser = new MajsoulUser(userData.amaeId);
    const { playerStats, playerExtendedStats } =
      await majsoulUser.fetchFullStats(game_limit);

    if (
      !majsoulUser.extendedStats ||
      !majsoulUser.playerStats ||
      !majsoulUser.rank
    ) {
      throw MJS_ERROR_TYPE.DATA_ERROR;
    }

    const stats = consolidateStats(
      majsoulUser,
      playerStats,
      playerExtendedStats
    );

    const { rank, rankLastWeek } = majsoulUser;

    if (rank.majorRank === MAJOR_RANK.Cl) {
      embed.setDescription(
        "Note: Bot may may have bugs for Celestial players."
      );
    }

    embed
      .setTitle(`Stats for ${playerStats.nickname}: Last ${game_limit} Games`)
      .setURL(amaeUrl(playerStats.id.toString()));

    displaySingleUserStats(stats, embed);

    const rankImage = rank.getImage();
    rankImage && embed.setThumbnail(rankImage);

    const imgName = `${userData.amaeId}-img.png`;
    const imgPath = `tmp/${imgName}`;

    await sharp(
      Buffer.from(
        generateCombinedSvg(majsoulUser.recentResults!, playerStats.rank_rates)
      )
    ).toFile(imgPath);
    embed.setImage(`attachment://${imgName}`);
    files.push({
      attachment: imgPath,
      name: imgName,
    });
  } catch (e: any) {
    console.error(e);
    if (!e.hasOwnProperty("mjsErrorType")) {
      throw e;
    }
    switch (e.mjsErrorType) {
      case MJS_ERROR_TYPE.NO_LINKED_USER:
        return "Please link your MajSoul account with Discord by running `ron mjs link <username>`, then try again.";

      case MJS_ERROR_TYPE.MULTIPLE_MATCHING_USERS:
        const ids = e.data.map(
          (id: string) => `- id ${id}: https://amae-koromo.sapk.ch/player/${id}`
        );
        return `Multiple players found with username ${inlineCode(
          mjsNickname
        )}. Which one are you looking for?\n${ids.join(
          "\n"
        )}\nPlease retry with ${inlineCode("ron mjs stats <id>")}`;

      case MJS_ERROR_TYPE.NO_MATCHING_USERS:
        return `No players found with username ${mjsNickname}`;

      case MJS_ERROR_TYPE.DATA_ERROR:
        return `Could not fetch the required information.`;

      default:
        throw e;
    }
  }

  await event.reply({
    embeds: [embed],
    files: files,
  });

  return "";
};
