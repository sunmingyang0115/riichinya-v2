import { CommandBuilder } from "../data/command_manager";
import { EventBuilder } from "../data/event_manager";
import { Events, Message } from "discord.js"

export class MessageCreateHandler implements EventBuilder {
    private messageMap : Map<string, CommandBuilder>;
    constructor (commands : CommandBuilder[]) {
        this.messageMap = new Map<string, CommandBuilder>;
        commands.forEach((command : CommandBuilder) => {
            this.messageMap.set(command.getCommandName(), command);
        })
    }
    getEventType(): string {
        return Events.MessageCreate;
    }
    getEventCallFunction(m : Message) {
        if (m.author.bot) return;
        let frag = m.content.split(/[ ,]+/);

        if (frag[0] == "ron" && this.messageMap.has(frag[1])) {
            this.messageMap.get(frag[1])!.runCommand(m, frag.slice(2));
        }
    }
}
