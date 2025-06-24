import { RiichiDatabase } from "../cmds/riichidb/sql_db";
import { EmbedBuilder, User } from "discord.js";
import { table } from "table";

export async function playerProfileCreator(user: User): Promise<EmbedBuilder> {
    // Fetch player data
    const statsArr = await RiichiDatabase.getPlayerProfile(user.id);
    const games = await RiichiDatabase.getPlayerResults(user.id);
    const opponentStats = await RiichiDatabase.getOpponentDelta(user.id);

    const stats = statsArr[0];
    const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Mahjong Profile`)
        .setThumbnail(user.displayAvatarURL())
        .setColor(0x00bfff)
        .setFooter({ text: `ID: ${user.id}` });
    const formatAdj = (adj: number) => {
        const val = adj.toFixed(1);
        return adj > 0 ? `+${val}` : val;
    };
    // Add stats
    if (stats) {
        // Calculate averages from available fields
        const avgPlacement = stats.rank_average;
        const adjAvg = stats.game_total > 0 ? (stats.score_adj_total / stats.game_total) : 0;
        const rawAvg = stats.game_total > 0 ? (stats.score_raw_total / stats.game_total) : 0;
        embed.addFields(
            { name: "Total Games", value: `${stats.game_total}`, inline: true },
            { name: "Avg. Placement", value: `${avgPlacement.toFixed(1)}`, inline: true },
            { name: "Adj. Score (Avg)", value: `${adjAvg.toFixed(1)}`, inline: true },
            { name: "Raw Score (Avg)", value: `${rawAvg.toFixed(1)}`, inline: true }
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
                formatAdj(g.adj/1000),
                g.raw,
                new Date(Number(g.time)).toLocaleDateString()
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
        

        if (worst && worst !== best) {
            embed.addFields({
            name: "Tile Feeder",
            value: `<@${worst[0]}>\n **${formatAdj(worst[1].adj / 1000)}** (Adj) over ${worst[1].games} game(s)`,
            inline: true
            });
        }
        if (best) {
            embed.addFields({
            name: "Challenging Matchup",
            value: `<@${best[0]}>\n **${formatAdj(best[1].adj / 1000)}** (Adj) over ${best[1].games} game(s)`,
            inline: true
            });
        }
        
        
    }

    return embed;
}

