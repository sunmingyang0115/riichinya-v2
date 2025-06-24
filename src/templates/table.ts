import { codeBlock, EmbedBuilder, inlineCode, Collection } from "discord.js";
import { table } from "table";
import { parseArgs } from "util";

export type TableHeader = {
  key: string;
  title: string;
  sortFunc: (a: any, b: any) => number;
};

/**
 * tableCreator takes in args, rows
 * @param embed 
 * @param args
 * @param rows the data to use. 
 * @param headers
 * @param toSplit if the data possibly contains non-latin characters, put it on the left side and split the table.
 * @returns 
 */
export const tableCreator = (
  embed: EmbedBuilder,
  args: string[],
  rows: any[][],
  headers: TableHeader[],
): EmbedBuilder => {
  try {

   
    if (headers.length === 0) {
      throw `No headers provided!`
    }
    let sortKey = headers[0].key;
    let keys = headers.map(x => x.key);
    let pageIndex = 1;
    
    // argument parsing
    const options = {
      'sortby': {
        type: 'string' as const,
        short: 's'
      },
      'page': {
        type: 'string' as const,
        short: 'p'
      },
      'asc': {
        type: 'string' as const,
        short: 'a'
      }
    }
    const {values: argValues, positionals: argPositionals} = parseArgs({args, options, allowPositionals: true});
    
    const rawSortKey = argValues.sortby || sortKey;
    // Allow page index to be passed in as a positional argument or an option.
    const rawPageIndex = parseInt(argPositionals[0]) || parseInt(String(argValues.page));
    if (headers.map(x => x.key).includes(rawSortKey)) {
      sortKey = rawSortKey;
    } else {
      throw `Unrecognized sort key. Options are ${headers.map(x => inlineCode(x.key)).join(', ')}.`
    }

    //Convert to index
    const sortIndex = headers.findIndex(x => x.key === sortKey);
    const sortFunc = headers[sortIndex].sortFunc;
    rows.sort((a, b) => sortFunc(a[sortIndex], b[sortIndex]));

    const headerText = headers.map(x => x.title);
  
    
    // If username is longer than this, insert newline in table.
    const USERNAME_WRAP_LEN = 13;
    // Points required to colour the delta red/green.
    const MAX_ROWS = 15;

    pageIndex = Math.min(pageIndex, Math.ceil(rows.length / MAX_ROWS));
    
    // Add fake pagination because discord cant have more than 1024 characters in a field.
    const pagedRows = rows.slice((pageIndex - 1) * MAX_ROWS, pageIndex * MAX_ROWS);

    // Split table into left and right half because DISCORD'S MONOSPACE FONT
    // ISNT MONOSPACE FOR NON-LATIN CHARACTERS
    // Have username on the very right side of the left table as to not cause problems
    // for the rest of the table.
    // Use custom borders to make the illusion of one contiguous table.

    const COL_TO_SPLIT = 2;
    
    const drawHorizontalLine = (lineIndex: number, rowCount: number) => {
          return lineIndex === 0 || lineIndex === 1 || lineIndex === rowCount || lineIndex % 5 === 1;
        };

    // Ranking and username
    const leftSide = table(
      [
        headerText.slice(0, COL_TO_SPLIT),
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
    const rightSide = table(
      [
        headerText.slice(COL_TO_SPLIT),
        ...pagedRows.map((row) => row.slice(COL_TO_SPLIT)),
      ],
      {
        border: { bodyLeft: "│", joinLeft: "┼", topLeft: "╤", bottomLeft: "╧" },
        drawHorizontalLine,
        columns: [{ alignment: "justify" }, { alignment: "right" }],
      }
    );
    embed.addFields(
      {
        name: `Page ${pageIndex} of ${Math.ceil(rows.length / MAX_ROWS)}`,
        value: codeBlock("ansi", leftSide),
        inline: true,
      },
      {
        name: "\u200b",
        value: codeBlock("ansi", rightSide),
        inline: true,
      }
    );
  } catch (e: any) {
    embed.setTitle("Error")
    embed.setDescription(e)
    console.error(e);
  }
  return embed;
};
