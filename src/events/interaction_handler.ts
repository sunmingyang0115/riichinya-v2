
import { parseScoreFromRaw } from "../cmds/riichidb/score_parser";
import { RiichiDatabase } from "../cmds/riichidb/sql_db";
import { EmbedManager } from "../data/embed_manager";
import { EventBuilder } from "../data/event_manager";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, Interaction, MessageFlags } from "discord.js"
import BotProperties from "../../bot_properties.json"
import { getTodaysWwyd, prepareWwydEmbed, readLeaderboard, writeLeaderboard } from "../cmds/wwyd";
import dayjs from "dayjs";
import { readFileSync } from "fs";

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

            // Load problem for the date encoded in the button
            const wwyds = JSON.parse(readFileSync("assets/wwyd-new.json", "utf-8"));
            const START_DATE = dayjs("2025-03-16");
            const idx = Math.max(0, Math.min(wwyds.length - 1, dayjs(date).diff(START_DATE, 'day')));
            const wwyd = wwyds[idx];

            // Update leaderboard
            const store = readLeaderboard();
            const gid = interaction.guildId;
            if (!store[gid]) store[gid] = {};
            const uid = interaction.user.id;
            if (!store[gid][uid]) store[gid][uid] = { attempts: 0, correct: 0, datesAttempted: [] };
            const u = store[gid][uid];

            
            const alreadyAttempted = !!(u.datesAttempted && u.datesAttempted.includes(date));
            if (tile === "pass" && !alreadyAttempted) { u.datesAttempted.push(date); writeLeaderboard(store); }
            if (alreadyAttempted) {
                const eb = new EmbedManager("wwyd", interaction.client);
                const explanationEmbed = new EmbedBuilder();
                const files = await prepareWwydEmbed(eb, explanationEmbed, true);
                await interaction.reply({embeds: [eb, explanationEmbed], files, flags: MessageFlags.Ephemeral });
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
                    if (channel && typeof channel.send === 'function') {
                        await channel.send(`<@${interaction.user.id}> was correct! (${u.correct} points)`);
                    }
                } else {
                    message = `❌ Incorrect. Currently ${u.correct}/${u.attempts} points`;
                }
                // Add explanation embeds
                const eb = new EmbedManager("wwyd", interaction.client);
                const explanationEmbed = new EmbedBuilder();
                const files = await prepareWwydEmbed(eb, explanationEmbed, true);
                await interaction.reply({ content: message, embeds: [eb, explanationEmbed], files, flags: MessageFlags.Ephemeral });

                u.datesAttempted = u.datesAttempted || [];
                u.datesAttempted.push(date);
                writeLeaderboard(store);
                
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
