
export interface EventBuilder {
    getEventType() : string;
    getEventCallFunction(args: unknown) : void;
}