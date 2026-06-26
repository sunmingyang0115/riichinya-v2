import { RiichiDatabase } from "../modules/riichidb/sql_db2";
import { EmbedBuilder, User } from "discord.js";
import { table } from "table";
import { generateCombinedSvg } from "../modules/mjs/charts"
import { Result } from "../modules/mjs/common";
import sharp from "sharp";
import { getLifetimeRankColor, getLifetimeRankIconFile } from "../modules/riichidb/lifetime_progression";
import { mkdirSync } from "fs";

const PROFILE_THUMBNAIL_SIZE = 160;
const PROFILE_RANK_ICON_SIZE = 160;

export interface PlayerProfileScope {
    season_id: string | null;
    display_name: string;
}

export async function playerProfileCreator(scope: PlayerProfileScope, user: User): Promise<[EmbedBuilder,{ attachment: string; name: string }[]]> {
    // Fetch player data
    // const [rank, statsArr, games] = await Promise.all([
    //     RiichiDatabase.getPlayerRank(user.id),
    //     RiichiDatabase.getPlayerProfile(user.id),
    //     RiichiDatabase.getPlayerResults(user.id)
    // ]);
    const [profile, recentGames, opponentDelta, lifetimeRank] = await Promise.all([
        RiichiDatabase.getPlayerProfile(scope.season_id, user.id),
        RiichiDatabase.getRecentGames(0, 20, scope.season_id, user.id),
        // I love arbitrary limits
        RiichiDatabase.getOpponentDelta(0, 200, scope.season_id, user.id),
        RiichiDatabase.getLifetimePlayer(user.id),
    ]);

    //need to subtract 1 because Result uses 0-index
    const rankResults = recentGames.map(g => g.rank - 1 as Result).reverse();
    const counts = [0, 1, 2, 3].map(n => rankResults.filter(x => x === n).length);
    
    // const opponentStats = await RiichiDatabase.getOpponentDelta(user.id);
    const files: { attachment: string; name: string }[] = [];
    const stats = profile;
    const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Mahjong Profile (${scope.display_name})`)
        .setColor(lifetimeRank ? getLifetimeRankColor(lifetimeRank.rank) : 0x00bfff)
        .setFooter({ text: `ID: ${user.id}` });

    const rankedAvatar = lifetimeRank
        ? await createRankedAvatarThumbnail(user, lifetimeRank.rank).catch(error => {
            console.error(error);
            return null;
        })
        : null;
    if (rankedAvatar) {
        embed.setThumbnail(`attachment://${rankedAvatar.name}`);
        files.push(rankedAvatar);
    } else {
        embed.setThumbnail(user.displayAvatarURL());
    }

    if (rankResults.length > 0) {
        const percentages = counts.map(count => count / rankResults.length);
        const svg = generateCombinedSvg(rankResults, percentages)
        const imgName = `${user.id}-img.png`;
        const imgPath = `tmp/${imgName}`;

        await sharp(Buffer.from(svg)).toFile(imgPath);
        embed.setImage(`attachment://${imgName}`);
        files.push({
            attachment: imgPath,
            name: imgName,
        });
    }

    const formatAdj = (adj: number) => {
        const val = adj.toFixed(1);
        return adj > 0 ? `+${val}` : val;
    };
    const formatLifetimePoints = (points: number) => String(Math.trunc(points));
    const lifetimeRankValue = lifetimeRank
        ? lifetimeRank.rank_limit === null
            ? `${lifetimeRank.rank_name} ${formatLifetimePoints(lifetimeRank.points)} pts`
            : `${lifetimeRank.rank_name} ${formatLifetimePoints(lifetimeRank.points)} / ${formatLifetimePoints(lifetimeRank.rank_limit)} pts`
        : "Unranked";
    // Add stats
    if (stats) {
        // Calculate averages from available fields
        const avgPlacement = stats.games_played > 0 ? (stats.total_placement / stats.games_played): 0;
        const adjAvg = stats.games_played > 0 ? (stats.total_score / 1000.0 / stats.games_played) : 0;
        const rawAvg = stats.games_played > 0 ? (stats.total_raw_score / 1000.0 / stats.games_played) : 0;
        embed.addFields(
            { name: "Lifetime Rank", value: lifetimeRankValue, inline: true },
            { name: "Leaderboard Rank", value: `${stats.rank}`, inline: true},
            { name: "Total Games", value: `${stats.games_played}`, inline: true },
            { name: "Avg. Placement", value: `${avgPlacement.toFixed(1)}`, inline: true },
            { name: "Adj. Score (Avg)", value: `${adjAvg.toFixed(1)}`, inline: true },
            { name: "Raw Score (Avg)", value: `${(rawAvg * 1000).toFixed(0)}`, inline: true }
        );
    } else {
        embed.setDescription("No stats found for this season scope.");
        if (lifetimeRank) {
            embed.addFields({ name: "Lifetime Rank", value: lifetimeRankValue, inline: true });
        }
    }
    // Game history (show up to 5 most recent) as a table
    if (recentGames && recentGames.length > 0) {
        const tableData = [
            ["Rank", "Adj", "Raw", "Date"],
            ...recentGames.slice(0, 5).map(g => [
            String(g.rank),
            formatAdj(g.adj_score / 1000),
            g.raw_score,
            (() => {
                const d = new Date(g.date);
                const month = d.getMonth() + 1;
                const monthStr = month < 10 ? `0${month}` : `${month}`;
                return `${monthStr}/${d.getDate()}`;
            })()
            ])
        ];
        const historyTable = table(tableData, {
            columnDefault: { alignment: 'center' }
        });
        embed.addFields({ name: "Recent Games", value: `\u200b\n${'```'}
${historyTable}${'```'}`, inline: false });
    }

    // Best and worst opponent by adj score diff
    if (opponentDelta && opponentDelta.length > 0) {
        // Convert to array and sort by adj diff
        // const arr = Array.from(opponentDelta.entries());
        const sorted = opponentDelta.sort((a, b) => b.adj_score_delta - a.adj_score_delta);
        const worst = sorted[0];
        const best = sorted[sorted.length - 1];
        embed.addFields({
            name: "Tile Feeder",
            value: `<@${worst.opponent_id}>\n **${formatAdj(worst.adj_score_delta / 1000)}** (Adj) over ${worst.games_played_together} game(s)`,
            inline: true
            },
            {
            name: "Challenging Matchup",
            value: `<@${best.opponent_id}>\n **${formatAdj(best.adj_score_delta / 1000)}** (Adj) over ${best.games_played_together} game(s)`,
            inline: true
        });
    }

    return [embed,files];
}

async function createRankedAvatarThumbnail(user: User, rank: number): Promise<{ attachment: string; name: string }> {
    mkdirSync("tmp", { recursive: true });

    const avatarUrl = user.displayAvatarURL({ extension: "png", size: 256 });
    const avatarResponse = await fetch(avatarUrl);
    if (!avatarResponse.ok) {
        throw new Error(`Failed to fetch Discord avatar for ${user.id}: ${avatarResponse.status}`);
    }

    const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());
    const avatar = await sharp(avatarBuffer)
        .resize(PROFILE_THUMBNAIL_SIZE, PROFILE_THUMBNAIL_SIZE, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
    const rankIcon = await sharp(`assets/${getLifetimeRankIconFile(rank)}`)
        .resize(PROFILE_RANK_ICON_SIZE, PROFILE_RANK_ICON_SIZE, { fit: "contain" })
        .png()
        .toBuffer();
    const rankIconOverlay = await centerOnSquareCanvas(rankIcon, PROFILE_THUMBNAIL_SIZE);

    const imgName = `${user.id}-rank.png`;
    const imgPath = `tmp/${imgName}`;
    await sharp({
        create: {
            width: PROFILE_THUMBNAIL_SIZE,
            height: PROFILE_THUMBNAIL_SIZE,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .composite([
            { input: avatar, left: 0, top: 0 },
            {
                input: rankIconOverlay,
                left: 0,
                top: 0,
            },
        ])
        .png()
        .toFile(imgPath);

    return {
        attachment: imgPath,
        name: imgName,
    };
}

async function centerOnSquareCanvas(image: Buffer, size: number): Promise<Buffer> {
    const metadata = await sharp(image).metadata();
    const width = metadata.width ?? size;
    const height = metadata.height ?? size;

    return sharp({
        create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .composite([{
            input: image,
            left: Math.floor((size - width) / 2),
            top: Math.floor((size - height) / 2),
        }])
        .png()
        .toBuffer();
}

