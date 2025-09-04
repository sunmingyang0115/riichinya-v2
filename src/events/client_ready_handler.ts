import { CronJob } from "cron";
import { EventBuilder } from "../data/event_manager";
import { Events, Client, TextChannel, EmbedBuilder} from "discord.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { GuildChannelMap, prepareWwydEmbed } from "../cmds/wwyd";
import { EmbedManager } from "../data/embed_manager";

export class ClientReadyHandler implements EventBuilder {
  getEventType(): string {
    return Events.ClientReady;
  }
  async getEventCallFunction(c: Client) {
    console.log("Client", c.user!.displayName, "online!");
    const wwydJob = new CronJob('0 10 * * *', () => {
      const channelLookupFile = "wwyd_channels.json";
      if (!existsSync(channelLookupFile)) {
        return;
      }
      const channels: GuildChannelMap = JSON.parse(
        readFileSync(channelLookupFile, "utf-8")
      );

      Object.values(channels).forEach(async (channelId: string) => {
        const eb = new EmbedManager("wwyd", c);
        const analysisEmbed = new EmbedBuilder();
        const files = await prepareWwydEmbed(eb, analysisEmbed);
        const channel = c.channels.cache.get(channelId) as TextChannel;
        channel.send({ embeds: [eb, analysisEmbed], files: files });
      });
    },
    null,
    true,
    "America/Toronto"
  );
    wwydJob.start();
  }
}
