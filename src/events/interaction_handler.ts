import { error } from "console";
import { parseScoreFromRaw } from "../cmds/riichidb/score_parser";
import { RiichiDatabase } from "../cmds/riichidb/sql_db";
import { EmbedManager } from "../data/embed_manager";
import { EventBuilder } from "../data/event_manager";
import { Events, Interaction } from "discord.js"

export class InteractionHandler implements EventBuilder {
    getEventType(): string {
        return Events.InteractionCreate;
    }
    async getEventCallFunction(interaction : Interaction)  {
        if (!interaction.isMessageContextMenuCommand()) return;
        let str = interaction.targetMessage.content;
        let splice = str.replace(/<@|>/g, "").split(/\s+/g);
        let content = `Successful ${interaction.targetMessage.id!}`;
        try {
            RiichiDatabase.insertData(interaction.targetMessage.id!, parseScoreFromRaw(splice));
        } catch(error : any) {
            content = error.toString();
        }

        await interaction.reply({
            embeds : [new EmbedManager("rdb", interaction.client).addContent(content)],
            ephemeral: true
        });
        
        
    }
}
