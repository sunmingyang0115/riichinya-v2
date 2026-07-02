import { MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction } from "discord.js";
import { EmbedManager } from "./embed_manager";
import { MessageContextMenuHandler } from "./bot_registrar";
import { BotConfig } from "./bot_config";

export class MessageContexMenuManager {
    private handlerMap: Map<string, MessageContextMenuHandler> = new Map();
    private rests: any[] = [];

    public addModule(rest: any, name: string, handler: MessageContextMenuHandler) {
        if (rest?.name !== name) {
            throw new Error(`msg ctx menu REST name mismatch: ${name} registered with REST name ${rest?.name}`);
        }
        if (this.handlerMap.get(name) !== undefined) {
            throw new Error(`duplicate msg ctx menu name for ${name}`);
        }
        this.handlerMap.set(name, handler);
        this.rests.push(rest);
    }

    public getRests() {
        return this.rests;
    }

    public async onInteraction(conf: BotConfig, interaction: MessageContextMenuCommandInteraction) {
        if (interaction.guildId === null || !conf.activeGuilds.includes(interaction.guildId!)) return;
        console.log(interaction);

        const handler = this.handlerMap.get(interaction.commandName);
        if (handler) {
            try {
                await handler(conf, interaction);
            } catch (e : any) {
                await interaction.reply({embeds : [EmbedManager.createErrorEmbed(e, interaction.client)]});
            }
        } else {
            // very likely a logic error
            console.error(`unhandled msg ctx interaction: ${interaction.commandName}`);
        }
    }
};
