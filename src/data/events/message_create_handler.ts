import { EventBuilder } from "./event_manager";
import { Events, Message } from "discord.js"

export = {
    getEventType(): string {
        return Events.MessageCreate;
    },
    async getEventCallFunction(m : Message) {
        if (m.author.bot) return;
        await m.reply(m.content);
    }
} as EventBuilder;
