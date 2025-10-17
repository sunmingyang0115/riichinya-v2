import { CronJob } from "cron";
import { EventBuilder } from "../data/event_manager";
import { Events, Client, TextChannel, EmbedBuilder} from "discord.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { GuildChannelMap, prepareWwydEmbed, buildDailyWwydMessage, readLeaderboard, writeLeaderboard } from "../cmds/wwyd";
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
        const channel = c.channels.cache.get(channelId) as TextChannel;
        if (!channel) return;

        // Daily mode with buttons
        const { embeds, files, components } = await buildDailyWwydMessage(eb);
        await channel.send({ embeds, files, components });
      });
    },
    null,
    true,
    "America/Toronto"
  );
    wwydJob.start();
  }
}
