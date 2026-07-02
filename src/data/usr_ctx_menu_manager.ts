import { UserContextMenuCommandInteraction } from "discord.js";
import { EmbedManager } from "./embed_manager";
import { UserContextMenuHandler } from "./bot_registrar";
import { BotConfig } from "./bot_config";

export class UserContexMenuManager {
    private handlerMap: Map<string, UserContextMenuHandler> = new Map();
    private rests: any[] = [];

    public addModule(rest: any, name: string, handler: UserContextMenuHandler) {
        if (rest?.name !== name) {
            throw new Error(`usr ctx menu REST name mismatch: ${name} registered with REST name ${rest?.name}`);
        }
        if (this.handlerMap.get(name) !== undefined) {
            throw new Error(`duplicate usr ctx menu name for ${name}`);
        }
        this.handlerMap.set(name, handler);
        this.rests.push(rest);
    }

    public getRests() {
        return this.rests;
    }

    public async onInteraction(conf: BotConfig, interaction: UserContextMenuCommandInteraction) {
        if (interaction.guildId === null || !conf.activeGuilds.includes(interaction.guildId!)) return;

        const handler = this.handlerMap.get(interaction.commandName);
        if (handler) {
            try {
                await handler(conf, interaction);
            } catch (e : any) {
                await interaction.reply({embeds : [EmbedManager.createErrorEmbed(e, interaction.client)]});
            }
        } else {
            // very likely a logic error
            console.error(`unhandled usr ctx interaction: ${interaction.commandName}`);
        }
    }
};
