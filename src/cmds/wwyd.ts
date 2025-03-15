import { DocBuilder, ExpectedType } from "../data/doc_manager";
import { CommandBuilder } from "../data/cmd_manager";
import { EmbedManager } from "../data/embed_manager";
import { EmbedBuilder, Guild, inlineCode, Message } from "discord.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import BotProperties from "../../bot_properties.json";

type GuildChannelMap = {
  [guildId: string]: string;
};

export class WwydCommand implements CommandBuilder {
  getDocumentation(): string {
    return new DocBuilder()
      .addSingleSubCom("ron", ExpectedType.LITERAL, "")
      .addSingleSubCom("wwyd", ExpectedType.LITERAL, "")
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
        `Available commands are ${inlineCode("enable")} and ${inlineCode(
          "disable"
        )}.`
      );
      event.reply({ embeds: [eb] });
    } else if (args[0] === "enable") {
      // Write access only
      // if (!BotProperties.writeAccess.includes(event.author.id)) return;
      if (args.length < 2) {
        eb.addContent(`Syntax: ${inlineCode("ron wwyd enable <channelId>")}`);
        event.reply({ embeds: [eb] });
        return;
      }
      const channelId = args[1];

      if (event.guildId && event.guild!.channels.cache.get(channelId)) {
        modifyChannels((channels: GuildChannelMap) => {
          channels[event.guildId as string] = args[1];
          return channels;
        });
      }
      eb.addContent(`Enabled sending daily WWYD's in <#${channelId}>.`);
    } else if (args[0] === "disable") {
      // Write access only
      // if (!BotProperties.writeAccess.includes(event.author.id)) return;
      if (event.guildId) {
        modifyChannels((channels: GuildChannelMap) => {
          delete channels[event.guildId as string];
          return channels;
        });
      }
      eb.addContent(`Disabled sending daily WWYD's.`);
    }
  }
}

export const sendTodaysWwyd = (guildId: number, channelId: number) => {
  // const channel = client.channels.cache.get("id");
  // client;
};
