import { codeBlock, EmbedBuilder, inlineCode, Message } from "discord.js";
import { MjsDatabase } from "./sql_db";
import { getAmaeIdFromNickname } from "./amae_api";
import { ANSI_COLOR, ansiFormat, MJS_ERROR_TYPE, MjsError } from "./common";
import { MajsoulUser } from "./majsoul_user";
import { Rank } from "./rank";
import { table } from "table";

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
          return b.getPtDelta() - a.getPtDelta();
        },
      },
    };

    let sortKey: keyof typeof sortOptions = "points";
    let pageIndex = 1;

    if (args[0] && args[0].trim().toLowerCase().includes("--sort-by=")) {
      const key = args[0].trim().toLowerCase().replace("--sort-by=", "");
      if (!Object.keys(sortOptions).includes(key)) {
        throw "Unrecognized sort key.";
      }
      sortKey = key as keyof typeof sortOptions;
    }
    
    if (args[0] && !isNaN(parseInt(args[0]))) {
      pageIndex = parseInt(args[0]);
    }

    const promises = linkedAccounts.map((user) => {
      const majsoulUser = new MajsoulUser(user.amaeId);
      return majsoulUser.fetchLightStats();
    });

    // Fetch user data in parallel to save time
    const majsoulUsers = await Promise.all(promises);

    const headers = ["", "Rank", "Name", "Points", "+/-"];

    // If username is longer than this, insert newline in table.
    const USERNAME_WRAP_LEN = 13;
    // Points required to colour the delta red/green.
    const PT_DELTA_THRESHOLD = 50;
    const MAX_ROWS = 15;

    const rows = majsoulUsers
      .sort(sortOptions[sortKey].cmp)
      .map((user, index) => {
        if (!user.rank) {
          throw MJS_ERROR_TYPE.DATA_ERROR;
        }
        const rankUpgradeEmoji = user.getRankDeltaEmoji();
        let ptsString = user.rank.ptsToString();

        let rankStr = ansiFormat(
          user.rank.rankToShortString(),
          user.rank.getAnsiColor()
        );

        const deltaFontColor =
          user.getPtDelta() > PT_DELTA_THRESHOLD
            ? ANSI_COLOR.GREEN
            : user.getPtDelta() < -PT_DELTA_THRESHOLD
            ? ANSI_COLOR.RED
            : ANSI_COLOR.DEFAULT;

        const deltaStr = ansiFormat(user.getPtDeltaStr(), deltaFontColor);

        let nicknameDisplay = user.mjsNickname;
        if (nicknameDisplay.length > USERNAME_WRAP_LEN) {
          nicknameDisplay =
            nicknameDisplay.slice(0, USERNAME_WRAP_LEN - 3) +
            "\n" +
            nicknameDisplay.slice(USERNAME_WRAP_LEN - 3);
          ptsString += "\n";
        }

        return [
          index + 1,
          `${rankStr}${rankUpgradeEmoji}`,
          `${nicknameDisplay}`,
          ptsString,
          deltaStr,
        ];
      });

    pageIndex = Math.min(pageIndex, Math.ceil(rows.length / MAX_ROWS));
    
    // Add fake pagination because discord cant have more than 1024 characters in a field.
    const pagedRows = rows.slice((pageIndex - 1) * MAX_ROWS, pageIndex * MAX_ROWS);

    // Split table into left and right half because DISCORD'S MONOSPACE FONT
    // ISNT MONOSPACE FOR NON-LATIN CHARACTERS
    // Have username on the very right side of the left table as to not cause problems
    // for the rest of the table.
    // Use custom borders to make the illusion of one contiguous table.

    const COL_TO_SPLIT = 3;
    
    const drawHorizontalLine = (lineIndex: number, rowCount: number) => {
          return lineIndex === 0 || lineIndex === 1 || lineIndex === rowCount || lineIndex % 5 === 1;
        };

    // Ranking and username
    const leftSide = table(
      [
        headers.slice(0, COL_TO_SPLIT),
        ...pagedRows.map((row) => row.slice(0, COL_TO_SPLIT)),
      ],
      {
        border: {
          bodyRight: " ",
          joinRight: "─",
          topRight: "═",
          bottomRight: "═",
        },
        drawHorizontalLine
      },
    );

    // Points and delta
    const rightSide = table(
      [
        headers.slice(COL_TO_SPLIT),
        ...pagedRows.map((row) => row.slice(COL_TO_SPLIT)),
      ],
      {
        border: { bodyLeft: "│", joinLeft: "┼", topLeft: "╤", bottomLeft: "╧" },
        drawHorizontalLine,
        columns: [{ alignment: "justify" }, { alignment: "right" }],
      }
    );

    embed.setTitle(`Server Leaderboard Sorted by ${sortOptions[sortKey].name}`);
    embed.addFields(
      {
        name: "\u200b",
        value: codeBlock("ansi", leftSide),
        inline: true,
      },
      {
        name: "\u200b",
        value: codeBlock("ansi", rightSide),
        inline: true,
      }
    );
    // embed.setDescription(codeBlock(leftSide));
  } catch (e: any) {
    console.error(e);
    throw e;
  }
  event.reply({
    embeds: [embed],
  });

  return "";
};
