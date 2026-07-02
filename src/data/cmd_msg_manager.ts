import { Message } from "discord.js";
import BotProperties from '../../bot_properties.json'
import { EmbedManager } from "./embed_manager";
import { MessageCommandHandler } from "./bot_registrar";
import { BotConfig } from "./bot_config";

export class MessageCommandManager {
    private messageMap: Map<string, MessageCommandHandler> = new Map();

    public addModule(commandName: string, handler: MessageCommandHandler) {
        if (this.messageMap.get(commandName) !== undefined) {
            throw new Error(`duplicate command message for ${commandName}`);
        }
        this.messageMap.set(commandName, handler);
    }

    public async onMessage(conf: BotConfig, m: Message) {
        if (m.author.bot) return;
        if (m.guildId === null || !BotProperties.activeGuilds.includes(m.guildId!)) return;

        const frag = m.content.split(/\s+/g);
        if (frag[0] == BotProperties.prefix && this.messageMap.has(frag[1])) {
            const handler = this.messageMap.get(frag[1])!;
            try {
                await handler(conf, m, frag.slice(2));
            } catch (e : any) {
                await m.reply({embeds : [EmbedManager.createErrorEmbed(e, m.client)]});
            }
        }
        // no one uses this lol
        // else if (frag[0] == BotProperties.helpPrefix && this.messageMap.has(frag[1])) {
        //     m.reply(this.messageMap.get(frag[1])!.getDocumentation());
        // }
    }
};
