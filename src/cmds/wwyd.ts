import { DocBuilder, ExpectedType } from "../data/doc_manager";
import { CommandBuilder } from "../data/cmd_manager";
import { EmbedManager } from "../data/embed_manager";
import {
  bold,
  EmbedBuilder,
  inlineCode,
  Message,
  spoiler,
} from "discord.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import BotProperties from "../../bot_properties.json";
import dayjs from "dayjs";
import sharp from "sharp";

export type GuildChannelMap = {
  [guildId: string]: string;
};

type Wwyd = {
  seat: "E" | "S" | "W" | "N";
  round: "E" | "S";
  turn: string;
  indicator: string;
  hand: string[];
  draw: string;
  answer: string;
  comment: (string | string[])[];
};

export class WwydCommand implements CommandBuilder {
  getDocumentation(): string {
    return new DocBuilder()
      .addSingleSubCom("ron", ExpectedType.LITERAL, "")
      .addSingleSubCom("wwyd", ExpectedType.LITERAL, "")
      .addSingleSubCom("today", ExpectedType.LITERAL, "Get today's wwyd")
      .back()
      .addSingleSubCom("random", ExpectedType.LITERAL, "Get random wwyd")
      .back()
      .addSingleSubCom("enable", ExpectedType.LITERAL, "")
      .addSingleSubCom(
        "channelId",
        ExpectedType.INTEGER,
        "Channel id to enable daily WWYD's in."
      )
      .back()
      .addSingleSubCom("disable", ExpectedType.LITERAL, "Disable daily WWYD")
      .build();
  }
  getCommandName(): string {
    return "wwyd";
  }
  getCooldown(): number {
    return 0;
  }

  async runCommand(event: Message<boolean>, args: string[]) {
    const channelLookupFile = "wwyd_channels.json";
    if (!existsSync(channelLookupFile)) {
      writeFileSync(channelLookupFile, "{}");
    }

    /**
     * Reads the channel data from disk, perform an operation via cb, then write the result to disk.
     * Use json file as a makeshift database to store which channels should be sent daily WWYD's.
     *
     * @param cb Callback to run on the retrieved data
     */
    const modifyChannels = (
      cb: (channels: GuildChannelMap) => GuildChannelMap
    ) => {
      const channels = JSON.parse(readFileSync(channelLookupFile, "utf-8"));
      const modifiedChannels = cb(channels);
      writeFileSync(channelLookupFile, JSON.stringify(modifiedChannels));
    };

    const eb = new EmbedManager(this.getCommandName(), event.client);

    if (args.length === 0) {
      eb.addContent(
        `Available commands are ${["today", "random", "enable", "disable"].map(cmd => inlineCode(cmd)).join(', ')}.`
      );
      event.reply({ embeds: [eb] });
      return;
    } else if (args[0] === "enable") {
      // Write access only
      if (!BotProperties.writeAccess.includes(event.author.id)) {
        return;        
      }

      const channelId = event.channel.id;

      if (event.guildId && event.guild!.channels.cache.get(channelId)) {
        modifyChannels((channels: GuildChannelMap) => {
          channels[event.guildId as string] = channelId;
          return channels;
        });
        eb.addContent(`Enabled sending daily WWYD's in <#${channelId}> at 10am every day.`);
      } else {
        eb.addContent(`Channel does not exist.`);
      }
      event.reply({ embeds: [eb] });
    } else if (args[0] === "disable") {
      // Write access only
      if (!BotProperties.writeAccess.includes(event.author.id)) {
        return;
      }

      if (event.guildId) {
        modifyChannels((channels: GuildChannelMap) => {
          delete channels[event.guildId as string];
          return channels;
        });
      }
      eb.addContent(`Disabled sending daily WWYD's.`);
    } else if (args[0] === "today") {
      const files = await prepareWwydEmbed(eb);
      event.reply({ embeds: [eb], files: files });
    } else if (args[0] === "random") {
      const files = await prepareWwydEmbed(eb, false);
      event.reply({ embeds: [eb], files: files });
    }
  }
}

/**
 * Generate an image to represent the WWYD problem.
 * 
 * @param wwyd WWYD object to generate image for,
 * @returns Image in the form of a Buffer object
 */
const generateWwydComposite = async (wwyd: Wwyd): Promise<Buffer> => {
  const HEADER_HEIGHT = 75;
  const TILE_WIDTH = 80;
  const TILE_GAP = 20;
  const TILE_HEIGHT = 129;
  const DORA_WIDTH = 35;

  const { round, seat, turn, indicator, hand, draw } = wwyd;

  const tiles = [...hand, draw].map((tile) => `assets/ui/${tile}.png`);

  // Draw the main 14 tiles with a gap between the tsumo tile and hand
  const composite: any[] = tiles.map((image, index) => ({
    input: image,
    left:
      index === tiles.length - 1
        ? index * TILE_WIDTH + TILE_GAP
        : index * TILE_WIDTH,
    top: HEADER_HEIGHT,
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
  }));

  const longName = {
    E: "東",
    S: "南",
    W: "西",
    N: "北",
  };

  const infoText = `<span foreground="white"><b>Round:${
    longName[round as keyof typeof longName]
  } Seat:${longName[seat as keyof typeof longName]} Turn:${turn}</b></span>`;

  // Make the images smaller for the dora wall
  const indicatorImage = await sharp(`assets/ui/${indicator}.png`)
    .resize({ width: DORA_WIDTH })
    .toBuffer();
  const doraBack = await sharp(`assets/ui/xm.png`)
    .resize({ width: DORA_WIDTH })
    .toBuffer();

  const doraWall = [
    doraBack,
    doraBack,
    indicatorImage,
    doraBack,
    doraBack,
    doraBack,
    doraBack,
  ];

  // Add the header and dora wall to the image inputs
  composite.push(
    {
      input: {
        text: {
          text: infoText,
          dpi: 200,
          rgba: true,
          font: "monospace",
        },
      },
      left: 20,
      top: 20,
    },
    ...doraWall.map((image, index) => ({
      input: image,
      left: 480 + index * DORA_WIDTH,
      top: 7,
    }))
  );
  
  // Draw the image
  return await sharp({
    create: {
      width: TILE_WIDTH * 14 + TILE_GAP,
      height: TILE_HEIGHT + HEADER_HEIGHT,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite(composite)
    .toFormat("png", { quality: 100 })
    .toBuffer();
};

/**
 * E.g. Transforms ["5p", "6p", "7p", "2s"] into "567p2s"
 *
 * @param tiles array of tiles in standard notation
 * @returns String of tiles in standard notation
 */
const compressNotation = (tiles: string[]): string => {
  const map = {
    m: "",
    p: "",
    s: "",
    z: "",
  };
  tiles.forEach((tile) => {
    map[tile[1] as "m" | "p" | "s" | "z"] += tile[0];
  });

  let str = "";

  Object.entries(map).forEach(([suit, values]) => {
    if (!values) {
      return;
    }
    str += values + suit;
  });

  return str;
};

/**
 * Prepare the embed for display. Image, title, fields, attachments etc.
 * Does not actually send the message out (channel/guild-agnostic).
 *
 * @param embed Discordjs embed object
 * @param useToday If true, generate today's. Otherwise, random.
 * @returns The files object to be sent alongside the embed.
 */
export const prepareWwydEmbed = async (
  embed: EmbedBuilder,
  useToday = true
): Promise<{ attachment: string; name: string }[]> => {
  const wwyds: Wwyd[] = JSON.parse(
    readFileSync("assets/wwyd-new.json", "utf-8")
  );
  const START_DATE = dayjs("2025-03-16");
  const today = dayjs();
  const wwyd = useToday
    ? wwyds[START_DATE.diff(today, "day")]
    : wwyds[Math.floor(Math.random() * wwyds.length)];

  embed.setTitle(`Answer: ${spoiler(wwyd.answer)}`);

  const parseCommentElements = (str: string[] | string) => {
    if (!Array.isArray(str)) {
      return str;
    }
    if (str[0] === "<b>") {
      return bold(str[1]);
    }
    return compressNotation(str);
  };

  embed.addFields({
    name: "Explanation",
    value: spoiler(wwyd.comment.map(parseCommentElements).join("")),
  });

  embed.setDescription(`WWYD: ${useToday ? today.format("YYYY-MM-DD") : "Random"}`);
  const outFileName = `${wwyd.hand}.png`;
  const outFilePath = `tmp/${outFileName}`;

  await sharp(await generateWwydComposite(wwyd)).toFile(outFilePath);
  embed.setImage(`attachment://${outFileName}`);
  return [
    {
      attachment: outFilePath,
      name: outFileName,
    },
  ];
};
