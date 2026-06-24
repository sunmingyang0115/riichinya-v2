import { BotRegistrar } from "./bot_registrar";

export interface BotModule {
    init(ctx: BotRegistrar): void | Promise<void>
};
