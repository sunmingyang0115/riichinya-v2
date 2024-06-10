import { ClientReadyHandler } from "../events/client_ready_handler.js";
import { MessageCreateHandler } from "../events/message_create_handler.js";

export interface EventBuilder {
    getEventType() : string;
    getEventCallFunction(...args: any[]) : void;
}