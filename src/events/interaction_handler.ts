
import { parseScoreFromRaw } from "../cmds/riichidb/score_parser";
import { RiichiDatabase } from "../cmds/riichidb/sql_db";
import { EmbedManager } from "../data/embed_manager";
import { EventBuilder } from "../data/event_manager";
import { Events, Interaction } from "discord.js"
import BotProperties from "../../bot_properties.json"

export class InteractionHandler implements EventBuilder {
    getEventType(): string {
        return Events.InteractionCreate;
    }
    async getEventCallFunction(interaction : Interaction)  {
        if (!interaction.isMessageContextMenuCommand()) return;
        if (!BotProperties.writeAccess.includes(interaction.user.id)) return;

        let str = interaction.targetMessage.content;
        let splice = str.replace(/<@|>/g, "").split(/\s+/g);
        let content = `Successful id:${interaction.targetMessage.id!}`;
        try {
            await RiichiDatabase.insertData(interaction.targetMessage.id!, parseScoreFromRaw(splice));
            await interaction.targetMessage.react("📥");
            await interaction.reply({
                embeds : [new EmbedManager("rdb", interaction.client).addContent(content)],
                ephemeral: true
            });
        } catch (e : any) {
            await interaction.reply({embeds : [EmbedManager.createErrorEmbed(e, interaction.client)]});
        }
    
    }
}
