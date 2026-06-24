import { ButtonInteraction, ChatInputCommandInteraction, Client, Message, MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction } from "discord.js";
import { Bot } from "./bot";
import { BotConfig } from "./bot_config";

export type BotReadyHandler = (conf: BotConfig, client: Client) => void | Promise<void>
export type MessageCommandHandler = (conf: BotConfig, msg: Message, args: string[]) => void | Promise<void>;
export type SlashCommandHandler = (conf: BotConfig, interaction: ChatInputCommandInteraction) => void | Promise<void>;
export type UserContextMenuHandler = (conf: BotConfig, interaction: UserContextMenuCommandInteraction) => void | Promise<void>;
export type MessageContextMenuHandler = (conf: BotConfig, interaction: MessageContextMenuCommandInteraction) => void | Promise<void>;
export type ButtonHandler = (conf: BotConfig, interaction: ButtonInteraction) => void | Promise<void>;

// the method for modules to register themselves to the bot

export interface BotRegistrar {
    addBotReady(handler: BotReadyHandler): void | Promise<void>;
    addMessageCommand(commandName: string, handler: MessageCommandHandler): void | Promise<void>;
    addSlashCommand(RESTdata: any, handler: SlashCommandHandler): void | Promise<void>;
    addUserContextMenu(RESTData: any, name: string, handler: UserContextMenuHandler): void | Promise<void>;
    addMessageContextMenu(RESTData: any, name: string, handler: MessageContextMenuHandler): void | Promise<void>
    addButton(customIdMatch: RegExp, handler: ButtonHandler): void | Promise<void>
}
