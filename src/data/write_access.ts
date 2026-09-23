import { APIInteractionGuildMember, GuildMember } from "discord.js";
import { BotConfig } from "./bot_config";

type WriteAccessMember = GuildMember | APIInteractionGuildMember | null;

/**
 * A member has write access when their user ID or any of their role IDs is allowed.
 */
export const hasWriteAccess = (
    conf: BotConfig,
    userId: string,
    member: WriteAccessMember,
): boolean => {
    if (conf.writeAccess.includes(userId)) {
        return true;
    }

    if (member === null || conf.roleWriteAccess.length === 0) {
        return false;
    }

    const memberRoleIds = Array.isArray(member.roles)
        ? member.roles
        : Array.from(member.roles.cache.keys());

    return memberRoleIds.some(roleId => conf.roleWriteAccess.includes(roleId));
};
