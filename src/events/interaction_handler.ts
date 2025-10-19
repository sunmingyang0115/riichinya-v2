
import { parseScoreFromRaw } from "../cmds/riichidb/score_parser";
import { RiichiDatabase } from "../cmds/riichidb/sql_db";
import { EmbedManager } from "../data/embed_manager";
import { EventBuilder } from "../data/event_manager";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, Interaction, MessageFlags } from "discord.js"
import BotProperties from "../../bot_properties.json"
import { prepareWwydEmbed, WWYD_DATA_PATH, START_DATE, type GuildMap, toWwydDate } from "../cmds/wwyd";
import dayjs from "dayjs";
import { existsSync, readFileSync, writeFileSync } from "fs";

export class InteractionHandler implements EventBuilder {
    getEventType(): string {
        return Events.InteractionCreate;
    }
    async getEventCallFunction(interaction : Interaction)  {

        
        // WWYD guess buttons
        if (interaction.isButton()) {
            try {
            const customId = interaction.customId;
            if (!customId.startsWith("wwyd:guess:")) return;
            if (!interaction.guildId) return;

            // Parse: wwyd:guess:YYYY-MM-DD:<tile>
            const parts = customId.split(":");
            const date = parts[2];
            const tile = parts[3];

            // Only allow the currently active WWYD window (10:00 -> next day's 10:00)
            const now = dayjs();
            const activeDateStr = toWwydDate(now).format("YYYY-MM-DD");
            if (date !== activeDateStr) {
                await interaction.deferUpdate();
                return;
            }

            // Acknowledge quickly; we'll edit the reply after processing
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // Load problem for the date encoded in the button
            const wwyds = JSON.parse(readFileSync("assets/wwyd-new.json", "utf-8"));
            const idx = Math.max(0, Math.min(wwyds.length - 1, dayjs(date).diff(START_DATE, 'day')));
            const wwyd = wwyds[idx];

            // Load and normalize the guild store once
            const gid = interaction.guildId!;
            const uid = interaction.user.id;
            let store: GuildMap = existsSync(WWYD_DATA_PATH)
                ? JSON.parse(readFileSync(WWYD_DATA_PATH, "utf-8"))
                : ({} as any);
            store[gid] ??= { channelId: "", players: {}, currentMessageId: "", dates: {} } as any;
            const g = store[gid];
            const u = (g.players[uid] ??= { attempts: 0, correct: 0, datesAttempted: [] } as any);

            
            
            let alreadyAttempted = !!(u.datesAttempted && u.datesAttempted.includes(date));
            if (tile === "pass" && !alreadyAttempted) {
                u.datesAttempted.push(date);
                writeFileSync(WWYD_DATA_PATH, JSON.stringify(store, null, 2), "utf-8");
                alreadyAttempted = true;
            }
            if (alreadyAttempted) {
                const eb = new EmbedManager("wwyd", interaction.client);
                const explanationEmbed = new EmbedBuilder();
                const files = await prepareWwydEmbed(eb, explanationEmbed, 0);
                await interaction.editReply({ content: "", embeds: [eb, explanationEmbed], files });
            }
            else {
                const correct = tile === wwyd.answer;

                u.attempts = (u.attempts ?? 0) + 1;

                let message = "";
                if (correct) {

                
                    u.correct = (u.correct ?? 0) + 1;

                    message = `✅ Correct! Currently ${u.correct}/${u.attempts} points`;

                    // Public announcement in the same channel
                    const channel: any = interaction.client.channels.cache.get(interaction.channelId!);
                    if (channel) {
                        await channel.send(`<@${interaction.user.id}> was correct! (${u.correct} points)`);
                    }
                } else {
                    message = `❌ Incorrect. Currently ${u.correct}/${u.attempts} points`;
                }
                // Add explanation embeds
                const eb = new EmbedManager("wwyd", interaction.client);
                const explanationEmbed = new EmbedBuilder();
                const files = await prepareWwydEmbed(eb, explanationEmbed, 0);
                await interaction.editReply({ content: message, embeds: [eb, explanationEmbed], files });

                
                const counts = (g.dates[date] ??= {} as any);
                counts[tile] = (counts[tile] ?? 0) + 1;
                u.datesAttempted.push(date);
                writeFileSync(WWYD_DATA_PATH, JSON.stringify(store, null, 2), "utf-8");
                
                return;
            
            }

            } catch (e) {
                console.error("Error handling WWYD button interaction:", e);
            }
            
        }

        // Existing context menu flow below (admin only)
        if (!interaction.isMessageContextMenuCommand()) return;
        if (!BotProperties.writeAccess.includes(interaction.user.id)) return;
        if (interaction.guildId === null || !BotProperties.activeGuilds.includes(interaction.guildId!)) return;

        try {
            let str = interaction.targetMessage.content;
            
            //make sure the message mentions 4 users
            // mentions.member does not recognize all pinged members - using mentions.users instead
            let mentions = interaction.targetMessage.mentions.users?.size;
            if (mentions !== 4) {
                throw new Error(`Message must mention 4 users, but found ${mentions}.`);
            }
            let splice = str.replace(/<@|>/g, "").split(/\s+/g);
            let content = `Successful id:${interaction.targetMessage.id!}`;

            let gameid = interaction.targetMessage.id!

            if (await RiichiDatabase.hasGameID(gameid)) {
                throw new Error(`Score already exists in database.`);
            }
        
            await RiichiDatabase.insertData(gameid, parseScoreFromRaw(splice));
            await interaction.targetMessage.react("📥");
            await interaction.reply({
                embeds : [new EmbedManager("rdb", interaction.client).addContent(content)],
                flags: MessageFlags.Ephemeral
            });
        } catch (e : any) {
            await interaction.reply({embeds : [EmbedManager.createErrorEmbed(e, interaction.client)]});
        }
    
    }
}
