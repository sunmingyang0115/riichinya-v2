import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Message } from "discord.js";
import { BotModule } from "../data/bot_module";
import { BotRegistrar } from "../data/bot_registrar";
import { BotConfig } from "../data/bot_config";

export class TestModule implements BotModule {
    
    async init(ctx: BotRegistrar) {
        ctx.addMessageCommand('test', this.onCommandMessage.bind(this));
        ctx.addBotReady((c) => {
        });
        ctx.addButton((/test:+/i), (conf, button) => {
            button.reply(`test ${button.customId}`);
        })
    }

    async onCommandMessage(conf: BotConfig, event: Message, args: string[]): Promise<void> {
        const btn1 = new ButtonBuilder()
                .setCustomId('test:1')
                .setLabel('Primary Action')
                .setStyle(ButtonStyle.Primary);
        
            const btn2 = new ButtonBuilder()
                .setCustomId('test:2')
                .setLabel('Danger Action')
                .setStyle(ButtonStyle.Danger);
        
            // 2. Put them in an Action Row
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(btn1, btn2);
        
            // 3. Send the message
            await event.reply({
                content: 'Choose an action:',
                components: [row]
            });
    }
    
}