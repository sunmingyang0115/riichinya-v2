import { Events, Message, Client, REST, SlashCommandBuilder, Routes } from "discord.js"
import { EventBuilder } from "./events/event_manager.js";

export class Bot {
    private token: string | undefined;
    private client: Client;

    constructor(_token: string | undefined) {
        this.token = _token;
        this.client = new Client({ intents: ['Guilds', 'GuildMessages', 'MessageContent'] });
        let events : EventBuilder[] = [require("./events/client_ready_handler.js")]
        events.forEach( (event : EventBuilder) => {
            this.client.on(event.getEventType(), event.getEventCallFunction());
        })
    }

    public run() {
        this.client.login(this.token);
    }

    public stop() {
        this.client.destroy();
    }
}