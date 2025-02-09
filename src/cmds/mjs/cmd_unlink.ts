import { EmbedBuilder, Message } from "discord.js";
import { MjsDatabase } from "./sql_db";
import { getAmaeIdFromNickname } from "./amae_api";
import { MJS_ERROR_TYPE, MjsError } from "./common";

/**
 *
 * @param event Discord bot message event
 * @param args Arguments passed to the link command
 * @returns
 */
export const unlinkHandler = async (
    event: Message<boolean>,
    args: string[],
    embed: EmbedBuilder
): Promise<string> => {
    const { author: discordAuthor } = event;
    try {
        const user = await MjsDatabase.getUser(discordAuthor.id);
        if (!user) {
            throw MJS_ERROR_TYPE.NO_LINKED_USER;
        }
        await MjsDatabase.deleteUser(discordAuthor.id);
        return `Successfully unlinked <@${discordAuthor.id}> from ${user.mjsNickname}`;
    } catch (e: any) {
        console.error(e);
        throw e;
    }
};
