export interface EventBuilder {
    getEventType() : string;
    getEventCallFunction(...args: any[]) : void;
}

export const events : EventBuilder[] = [
    require("./events/client_ready_handler.js"),
    require("./events/message_create_handler.js")
]