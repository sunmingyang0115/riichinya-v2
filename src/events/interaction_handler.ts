
import { parseScoreFromRaw } from "../cmds/riichidb/score_parser";
import { RiichiDatabase } from "../cmds/riichidb/sql_db";
import { EmbedManager } from "../data/embed_manager";
import { EventBuilder } from "../data/event_manager";
import { Events, Interaction, MessageFlags } from "discord.js"
import BotProperties from "../../bot_properties.json"

export class InteractionHandler implements EventBuilder {
    getEventType(): string {
        return Events.InteractionCreate;
    }
    async getEventCallFunction(interaction : Interaction)  {
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
