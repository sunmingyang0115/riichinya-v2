import { RiichiDatabase } from "../cmds/riichidb/sql_db";
import { EmbedBuilder, User } from "discord.js";
import { table } from "table";
import { generateCombinedSvg } from "../cmds/mjs/charts"
import { Result } from "../cmds/mjs/common";
import sharp from "sharp";

export async function playerProfileCreator(user: User): Promise<[EmbedBuilder,{ attachment: string; name: string }[]]> {
    // Fetch player data
    const [rank, statsArr, games] = await Promise.all([
        RiichiDatabase.getPlayerRank(user.id),
        RiichiDatabase.getPlayerProfile(user.id),
        RiichiDatabase.getPlayerResults(user.id)
    ]);
    //need to subtract 1 because Result uses 0-index
    const rankResults = games.map(g => g.rank - 1 as Result).reverse();
    const counts = [0, 1, 2, 3].map(n => rankResults.filter(x => x === n).length);
    
    const opponentStats = await RiichiDatabase.getOpponentDelta(user.id);
    const percentages = counts.map(count => count / rankResults.length);

    const svg = generateCombinedSvg(rankResults, percentages)

    const imgName = `${user.id}-img.png`;
    const imgPath = `tmp/${imgName}`;

    await sharp(Buffer.from(svg)).toFile(imgPath);
    const stats = statsArr[0];
    const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Mahjong Profile`)
        .setThumbnail(user.displayAvatarURL())
        .setColor(0x00bfff)
        .setFooter({ text: `ID: ${user.id}` });

    embed.setImage(`attachment://${imgName}`);

    const files = [{
        attachment: imgPath,
        name: imgName,
    }]

    const formatAdj = (adj: number) => {
        const val = adj.toFixed(1);
        return adj > 0 ? `+${val}` : val;
    };
    // Add stats
    if (stats) {
        // Calculate averages from available fields
        const avgPlacement = stats.rank_total / stats.game_total;
        const adjAvg = stats.game_total > 0 ? (stats.score_adj_total / stats.game_total) : 0;
        const rawAvg = stats.game_total > 0 ? (stats.score_raw_total / stats.game_total) : 0;
        embed.addFields(
            { name: "Rank", value: `${rank[0].rank}`, inline: true},
            { name: "Avg. Placement", value: `${avgPlacement.toFixed(1)}`, inline: true },
            { name: "Total Games", value: `${stats.game_total}`, inline: true },
            { name: "\t", value: "\t"},
            { name: "Adj. Score (Avg)", value: `${adjAvg.toFixed(1)}`, inline: true },
            { name: "Raw Score (Avg)", value: `${(rawAvg * 1000).toFixed(0)}`, inline: true }
        );
    } else {
        embed.setDescription("No stats found for this player.");
    }
    // Game history (show up to 5 most recent) as a table
    if (games && games.length > 0) {
        const tableData = [
            ["Rank", "Adj", "Raw", "Date"],
            ...games.slice(0, 5).map(g => [
            String(g.rank),
            formatAdj(g.adj / 1000),
            g.raw,
            (() => {
                const d = new Date(Number(g.time));
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
    if (opponentStats && opponentStats.size > 0) {
        // Convert to array and sort by adj diff
        const arr = Array.from(opponentStats.entries());
        arr.sort((a, b) => b[1].adj - a[1].adj);
        const worst = arr[0];
        const best = arr[arr.length - 1];
        embed.addFields({
            name: "Tile Feeder",
            value: `<@${worst[0]}>\n **${formatAdj(worst[1].adj / 1000)}** (Adj) over ${worst[1].games} game(s)`,
            inline: true
            },
            {
            name: "Challenging Matchup",
            value: `<@${best[0]}>\n **${formatAdj(best[1].adj / 1000)}** (Adj) over ${best[1].games} game(s)`,
            inline: true
        });
    }

    return [embed,files];
}

