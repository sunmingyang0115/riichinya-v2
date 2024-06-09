
export interface CommandBuilder {
    getCommandName() : String;
    getCooldown() : Number;
    runCommand(event : MessageEvent) : void;
}