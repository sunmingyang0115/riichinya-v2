import { CronJob } from "cron";
import { EventBuilder } from "../data/event_manager";
import { Events, Client, TextChannel, EmbedBuilder} from "discord.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { GuildMap, prepareWwydEmbed, buildDailyWwydMessage, WWYD_DATA_PATH } from "../cmds/wwyd";
import { EmbedManager } from "../data/embed_manager";
import dayjs from "dayjs";

export class ClientReadyHandler implements EventBuilder {
  getEventType(): string {
    return Events.ClientReady;
  }
  async getEventCallFunction(c: Client) {
    console.log("Client", c.user!.displayName, "online!");
    const wwydJob = new CronJob('35 18 * * *', async () => {
      if (!existsSync(WWYD_DATA_PATH)) {
        return;
      }
      const guilds: GuildMap = JSON.parse(
        readFileSync(WWYD_DATA_PATH, "utf-8")
      );

      for (const guildId in guilds) {
        let guildData = guilds[guildId];
        const eb = new EmbedManager("wwyd", c);
        const channel = c.channels.cache.get(guildData.channelId) as TextChannel;
        if (!channel) continue;

        const prevMessage = guildData.currentMessageId;
        if (prevMessage) {
          try {
            const msg = await channel.messages.fetch(prevMessage);
            if (msg) {
              // Prepare yesterday's explanation embed and counts content
              let files = await prepareWwydEmbed(eb, new EmbedBuilder(), 1);
              const dateStr = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
              const dateCounts = guildData.dates?.[dateStr] || {};
              const entries = Object.entries(dateCounts);
              const total = entries.reduce((acc, [, c]) => acc + (c as number), 0);
              entries.sort((a, b) => (b[1] as number) - (a[1] as number));
              const summary = entries.map(([tile, count]) => `${tile}:${count}`).join(" ");
              const oneLine = entries.length > 0
                ? `Results ${dateStr} | ${summary} | Total:${total}`
                : `Results ${dateStr} | No responses recorded.`;
              const content = `\`\`\`text\n${oneLine}\n\`\`\``;
              await msg.edit({ content, embeds: [eb], files, components: []});
            }
          } catch (e) {
            console.log("Failed to fetch previous WWYD message:", e);
          }
        }

        // Daily mode with buttons
        const { embeds, files, components } = await buildDailyWwydMessage(eb);
        const sent = await channel.send({ embeds, files, components });
        // Update the current message ID using the sent message
        guilds[guildId].currentMessageId = sent.id;

      }

      writeFileSync(WWYD_DATA_PATH, JSON.stringify(guilds, null, 2), "utf-8");
    },
    null,
    true,
    "America/Toronto"
  );
    wwydJob.start();
  }
}
