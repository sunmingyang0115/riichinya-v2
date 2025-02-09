import { EmbedBuilder, inlineCode, Message } from "discord.js";
import { UserIdData, MjsDatabase } from "./sql_db";
import {
  amaeUrl,
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

type StatConfig = {
  [key: string]: {
    label: string;
    value: number;
    formatter: (value: number) => string;
    cmp: (a: number, b: number) => number;
  };
};

const consolidateStats = (
  playerStats: PlayerStatsResponse,
  extendedStats: PlayerExtendedStatsResponse
): StatConfig => {
  const cmpHigh = (a: number, b: number) => b - a;
  const cmpLow = (a: number, b: number) => a - b;

  const stats = {
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
    // uradoraRate: {
    //   label: "Uradora Rate",
    //   value: extendedStats["里宝率"],
    //   formatter: formatPercent,
    //   cmp: cmpHigh,
    // },
  };
  return stats;
};

const displaySingleUserStats = (statsData: StatConfig, embed: EmbedBuilder) => {
  const label = (stat: keyof StatConfig) => statsData[stat].label;
  const value = (stat: keyof StatConfig) =>
    inlineCode(statsData[stat].formatter(statsData[stat].value));
  embed.addFields(
    {
      name: label("recordedMatches"),
      value: value("recordedMatches"),
      inline: true,
    },
    { name: label("dealInRate"), value: value("dealInRate"), inline: true },
    { name: label("winRate"), value: value("winRate"), inline: true },
    { name: label("callRate"), value: value("callRate"), inline: true }
    // { name: label("uradoraRate"), value: value("uradoraRate"), inline: true },
  );

  return embed;
};

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
    if (args.length === 0) {
      userData = await MjsDatabase.getUser(discordAuthor.id);
    } else if (args.length === 1) {
      let amaeId: string;
      // This clause checks if the nickname entered is in id format (all digits)
      // If so, bypass the nickname lookup and use arg[0] as amae id.
      if (mjsNickname.match(/^\d+$/g)) {
        amaeId = args[0];
      } else {
        amaeId = await getAmaeIdFromNickname(mjsNickname);
      }
      userData = {
        amaeId,
        mjsNickname,
        discordId: discordAuthor.id,
      };
    } else {
      return "Too many arguments: expected 0 or 1 arguments.";
    }

    if (!userData) {
      throw { mjsErrorType: MJS_ERROR_TYPE.NO_LINKED_USER };
    }

    const majsoulUser = new MajsoulUser(userData.amaeId);
    const { playerStats, playerExtendedStats } =
      await majsoulUser.fetchFullStats(100);
    const stats = consolidateStats(playerStats, playerExtendedStats);

    if (
      !majsoulUser.extendedStats ||
      !majsoulUser.playerStats ||
      !majsoulUser.rank
    ) {
      throw MJS_ERROR_TYPE.DATA_ERROR;
    }

    if (majsoulUser.rank.majorRank === MAJOR_RANK.Cl) {
      embed.setDescription(
        "Note: Bot may may have bugs for Celestial players."
      );
    }

    embed
      .setTitle(`Stats for ${playerStats.nickname}: Last 100 Games`)
      .setURL(amaeUrl(playerStats.id.toString()));

    const { rank, rankLastWeek } = majsoulUser;

    let rankString = rank.rankToShortString();
    let ptsString = rank.ptsToString();

    if (rankLastWeek) {
      rankString += majsoulUser.getRankDeltaEmoji();
      ptsString += ` (${majsoulUser.getPtDeltaStr()})`;
    }

    embed.addFields({ name: "Rank", value: inlineCode(rankString), inline: true });
    embed.addFields({ name: "Points", value: inlineCode(ptsString), inline: true });
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
        return `Multiple players found with username ${inlineCode(mjsNickname)}. Which one are you looking for?\n${ids.join(
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
