import { Client, Routes, ContextMenuCommandBuilder, ApplicationCommandType, Message, Interaction, REST } from "discord.js"
import { ButtonManager } from "./button_manager";
import { BotRegistrar, BotReadyHandler, ButtonHandler, MessageCommandHandler, MessageContextMenuHandler, SlashCommandHandler, UserContextMenuHandler } from "./bot_registrar";
import { MessageCommandManager } from "./cmd_msg_manager";
import { UserContexMenuManager as UserContexMenuManager } from "./usr_ctx_menu_manager";
import { BotConfig } from "./bot_config";
import { MessageContexMenuManager } from "./msg_ctx_menu_manager";

export class Bot implements BotRegistrar{
    private token: string;
    private client: Client;
    private config: BotConfig;
    private botReadyModules: BotReadyHandler[] = []
    private msgCommandManager = new MessageCommandManager();
    private usrCtxMenuManager = new UserContexMenuManager();
    private msgCtxMenuManager = new MessageContexMenuManager();
    private buttonManager = new ButtonManager();

    // private messageCtxMenuModules: MessageCtxMenuListener[] = []
    // private slashListenerModules: SlashListener[] = []
    // private userCtxMenuModules: UserCtxMenuListener[] = []


    constructor(token: string, config: BotConfig) {
        this.token = token;
        this.config = config;
        this.client = new Client({ intents: ['Guilds', 'GuildMessages', 'MessageContent'] });
    }
    addBotReady(handler: BotReadyHandler): void | Promise<void> {
        this.botReadyModules.push(handler);
    }
    addMessageCommand(commandName: string, handler: MessageCommandHandler): void | Promise<void> {
        this.msgCommandManager.addModule(commandName, handler);
    }
    addSlashCommand(RESTdata: any, handler: SlashCommandHandler): void | Promise<void> {
        throw new Error("Method not implemented.");
    }
    addUserContextMenu(RESTData: any, name: string, handler: UserContextMenuHandler): void | Promise<void> {
        this.usrCtxMenuManager.addModule(RESTData, name, handler);
    }
    addMessageContextMenu(RESTData: any, name: string, handler: MessageContextMenuHandler): void | Promise<void> {
        this.msgCtxMenuManager.addModule(RESTData, name, handler);
    }
    addButton(customIdMatch: RegExp, handler: ButtonHandler): void | Promise<void> {
        this.buttonManager.addModule(customIdMatch, handler);
    }


    public async run() {
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);
        const restBody = [
            ...this.usrCtxMenuManager.getRests(),
            ...this.msgCtxMenuManager.getRests()
        ];
        this.assertUniqueApplicationCommandNames(restBody);

        for (let guildid of this.config.activeGuilds) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildid),
                { body : restBody },
            );
            console.log(`Successfully reloaded application commands for guild ${guildid}.`);
        }

        this.client.on('clientReady', (client: Client) => {
            this.botReadyModules.forEach(async e => await e(this.config, client));
        });
        this.client.on('messageCreate', (msg: Message) => {
            this.msgCommandManager.onMessage(this.config, msg);
        })
        this.client.on('interactionCreate', (inter: Interaction) => {
            if (inter.isButton()) {
                this.buttonManager.onButton(this.config, inter);
            } else if (inter.isUserContextMenuCommand()) {
                this.usrCtxMenuManager.onInteraction(this.config, inter);
            } else if (inter.isMessageContextMenuCommand()) {
                this.msgCtxMenuManager.onInteraction(this.config, inter);
            }
        })
        this.client.login(this.token);
    }

    private assertUniqueApplicationCommandNames(commands: any[]) {
        const names = new Set<string>();
        for (const command of commands) {
            const name = command?.name;
            if (typeof name !== "string") {
                throw new Error(`application command is missing a string name: ${JSON.stringify(command)}`);
            }
            if (names.has(name)) {
                throw new Error(`duplicate application command name: ${name}`);
            }
            names.add(name);
        }
    }

    public stop() {
        this.client.destroy();
    }
}
