import { CommandBuilder } from "../data/cmd_manager";
import { EventBuilder } from "../data/event_manager";
import { Events, Message } from "discord.js"
import BotProperties from '../../bot_properties.json'
import { EmbedManager } from "../data/embed_manager";

export class MessageCreateHandler implements EventBuilder {
    private messageMap: Map<string, CommandBuilder>;
    constructor(commands: CommandBuilder[]) {
        this.messageMap = new Map<string, CommandBuilder>;
        commands.forEach((command: CommandBuilder) => {
            this.messageMap.set(command.getCommandName(), command);
        });
    }
    getEventType(): string {
        return Events.MessageCreate;
    }
    async getEventCallFunction(m: Message) {
        if (m.author.bot) return;
        let frag = m.content.split(/\s+/g);
        if (frag[0] == BotProperties.prefix && this.messageMap.has(frag[1])) {
            let command = this.messageMap.get(frag[1])!;
            try {
                await command.runCommand(m, frag.slice(2));
            } catch (e : any) {
                await m.reply({embeds : [EmbedManager.createErrorEmbed(e, m.client)]});
            }
        }
        else if (frag[0] == BotProperties.helpPrefix && this.messageMap.has(frag[1])) {
            m.reply(this.messageMap.get(frag[1])!.getDocumentation());
        }
    }
}
