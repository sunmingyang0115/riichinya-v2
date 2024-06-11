
export interface EventBuilder {
    getEventType() : string;
    getEventCallFunction(...args: any[]) : void;
}