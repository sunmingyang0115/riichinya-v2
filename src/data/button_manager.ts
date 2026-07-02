import { ButtonInteraction } from "discord.js";
import { ButtonHandler } from "./bot_registrar";
import { BotConfig } from "./bot_config";

export class ButtonManager {
    private events: [RegExp, ButtonHandler][] =[];

    public addModule(customIdMatch: RegExp, handler: ButtonHandler) {
        this.events.push([customIdMatch, handler]);
    }

    public async onButton(conf: BotConfig, event: ButtonInteraction) {
        this.events.forEach(async e => {
            console.log(event.customId);
            if (e[0].exec(event.customId)) {
                await e[1](conf, event);
            }
        })
    }
}