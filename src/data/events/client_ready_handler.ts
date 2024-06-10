import { EventBuilder } from "./event_manager";
import { Events, Client } from "discord.js"

export = {
    getEventType(): string {
        return Events.ClientReady;
    },
    async getEventCallFunction(c : Client)  {
        console.log("Client", c.user!.displayName, "online!");
    }
} as EventBuilder;
