import { RiichiDatabase } from "../cmds/riichidb/sql_db2";
import { EmbedBuilder, User } from "discord.js";
import { table } from "table";
import { generateCombinedSvg } from "../cmds/mjs/charts"
import { Result } from "../cmds/mjs/common";
import sharp from "sharp";

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
    const profile = await RiichiDatabase.getPlayerProfile(scope.season_id, user.id);
    const recentGames = await RiichiDatabase.getRecentGames(0, 20, scope.season_id, user.id);
    // I love arbitrary limits
    const opponentDelta = await RiichiDatabase.getOpponentDelta(0, 200, scope.season_id, user.id);

    //need to subtract 1 because Result uses 0-index
    const rankResults = recentGames.map(g => g.rank - 1 as Result).reverse();
    const counts = [0, 1, 2, 3].map(n => rankResults.filter(x => x === n).length);
    
    // const opponentStats = await RiichiDatabase.getOpponentDelta(user.id);
    const stats = profile;
    const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Mahjong Profile (${scope.display_name})`)
        .setThumbnail(user.displayAvatarURL())
        .setColor(0x00bfff)
        .setFooter({ text: `ID: ${user.id}` });

    const files: { attachment: string; name: string }[] = [];
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
    // Add stats
    if (stats) {
        // Calculate averages from available fields
        const avgPlacement = stats.games_played > 0 ? (stats.total_placement / stats.games_played): 0;
        const adjAvg = stats.games_played > 0 ? (stats.total_score / 1000.0 / stats.games_played) : 0;
        const rawAvg = stats.games_played > 0 ? (stats.total_raw_score / 1000.0 / stats.games_played) : 0;
        embed.addFields(
            { name: "Rank", value: `${stats.rank}`, inline: true},
            { name: "Avg. Placement", value: `${avgPlacement.toFixed(1)}`, inline: true },
            { name: "Total Games", value: `${stats.games_played}`, inline: true },
            { name: "\t", value: "\t"},
            { name: "Adj. Score (Avg)", value: `${adjAvg.toFixed(1)}`, inline: true },
            { name: "Raw Score (Avg)", value: `${(rawAvg * 1000).toFixed(0)}`, inline: true }
        );
    } else {
        embed.setDescription("No stats found for this player.");
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

