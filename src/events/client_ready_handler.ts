import { EventBuilder } from "../data/event_manager";
import { Events, Client } from "discord.js"

export class ClientReadyHandler implements EventBuilder {
    getEventType(): string {
        return Events.ClientReady;
    }
    async getEventCallFunction(c : Client)  {
        console.log("Client", c.user!.displayName, "online!");
    }
}
