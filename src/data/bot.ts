import { Client, Routes, ContextMenuCommandBuilder, ApplicationCommandType } from "discord.js"
import { EventBuilder } from "./event_manager.js";
import { ClientReadyHandler } from "../events/client_ready_handler.js";
import { MessageCreateHandler } from "../events/message_create_handler.js";
import { CommandBuilder } from "./cmd_manager.js";
import { PingCommand } from "../cmds/ping.js";
import { EvalCommand } from "../cmds/eval.js";
import { TestCommand } from "../cmds/test.js";
import { RiichiDbCommand } from "../cmds/riichidb.js";
import { InteractionHandler } from "../events/interaction_handler.js";
import { MjsCommand } from "../cmds/mjs.js";
import { WwydCommand } from "../cmds/wwyd.js";
import { TableCommand } from "../cmds/table.js";

export class Bot {
    private token: string | undefined;
    private client: Client;

    constructor(_token: string | undefined) {
        let commands : CommandBuilder[] = [
            new PingCommand(),
            new EvalCommand(),
            new TestCommand(),
            new MjsCommand(),
            new WwydCommand(),
            new RiichiDbCommand(),
            new TableCommand()
        ];
        let events : EventBuilder[] = [
            new ClientReadyHandler(),
            new MessageCreateHandler(commands),
            new InteractionHandler()
        ];
        this.token = _token;
        this.client = new Client({ intents: ['Guilds', 'GuildMessages', 'MessageContent'] });
        this.addEventHandles(events);
    }

    private addEventHandles(events : EventBuilder[]) {
        events.forEach((event : EventBuilder) => {
            this.client.on(event.getEventType(), event.getEventCallFunction.bind(event));
        });
    }

    public run() {
        this.client.login(this.token);
    }

    public stop() {
        this.client.destroy();
    }
}