import { ApplicationCommandType, Collection, ContextMenuCommandBuilder, MessageContextMenuCommandInteraction } from "discord.js";
import { BotModule } from "../data/bot_module";
import { BotRegistrar } from "../data/bot_registrar";
import { BotConfig } from "../data/bot_config";

export class MakeTable implements BotModule {
    MAKE_TABLE_COMMAND = "Make Tables";

    init(ctx: BotRegistrar): void | Promise<void> {
        const rest_league = new ContextMenuCommandBuilder()
            .setName(this.MAKE_TABLE_COMMAND)
            .setType(ApplicationCommandType.Message);
        ctx.addMessageContextMenu(rest_league.toJSON(), this.MAKE_TABLE_COMMAND, this.messageCtxHandler.bind(this));
    }

    async messageCtxHandler(conf: BotConfig, interaction: MessageContextMenuCommandInteraction) {
        if (!conf.writeAccess.includes(interaction.user.id)) return;
        await interaction.deferReply();

        const reactions = Array.from(interaction.targetMessage.reactions.cache.values());

        const usersPerReaction = await Promise.all(
            reactions.map(r =>
                r.users.cache.size >= r.count ? Promise.resolve(r.users.cache) : r.users.fetch()
            )
        );

        const usernames = usersPerReaction
            .flatMap(userCollection => Array.from(userCollection.values(), u => u.username));
        const uniqueUsernames = [...new Set(usernames)];

        let msg = "";
        const tables = Math.trunc(uniqueUsernames.length / 4);
        
        for (let n = 0; n < tables; n++) {
            msg += 
`
Table ${n+1}.
East:  ${uniqueUsernames[n+0]}
West:  ${uniqueUsernames[n+1]}
South: ${uniqueUsernames[n+2]}
North: ${uniqueUsernames[n+3]}

`;
        }
        
        if (4*tables < uniqueUsernames.length) {
            msg += `Ungrouped: \n`;
            for (let n = 4*tables; n < uniqueUsernames.length; n++) {
                msg += `${uniqueUsernames[n]}\n`;
            }
        }

        interaction.editReply(msg);
    }

}
