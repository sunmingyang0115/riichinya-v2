import { Message, Client, AttachmentBuilder, Collection, MessageContextMenuCommandInteraction, ContextMenuCommandBuilder, ApplicationCommandType } from "discord.js";
import { DocBuilder, ExpectedType } from "../data/doc_manager";
import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
// import { DataGameSQLEntry, DataPlayerSQLEntry, playerDataAttr, RiichiDatabase } from "./riichidb/sql_db2";
import { GameInfoEntry, parseScoreFromRaw } from "./riichidb/score_parser2";
import { EmbedManager, Header } from "../data/embed_manager";
import { parse } from "json2csv";
import { playerProfileCreator, PlayerProfileScope } from "../templates/playerProfile";
import { RiichiDatabase } from "./riichidb/sql_db2";
import { GameEntry, ParticipantEntry, SeasonEntry } from "./riichidb/db_struct";
import { LeaderboardStatKey, SeasonAdjustedStanding } from "./riichidb/query_struct";
import BotProperties from "../../bot_properties.json"
import { BotModule } from "../data/bot_module";
import { BotRegistrar } from "../data/bot_registrar";
import { BotConfig } from "../data/bot_config";
import { LifetimePlayerState } from "./riichidb/lifetime_progression";
import { mkdirSync, writeFileSync } from "fs";

dayjs.extend(utc);
dayjs.extend(timezone);

type SeasonSelectorType = "default" | "all" | "current" | "league" | "season";
const DEFAULT_LEADERBOARD_AMOUNT = 50;
const DEFAULT_LIFETIME_RANK_AMOUNT = 30;
const MAX_FIELD_LEADERBOARD_AMOUNT = 40;
const MAX_MOBILE_LEADERBOARD_AMOUNT = 100;
const MAX_LIFETIME_RANK_AMOUNT = 100;
const MAX_EMBED_DESCRIPTION_LENGTH = 3900;
const LEAGUE_WEEKLY_GAME_LIMIT = 2;
const LEAGUE_WEEK_START_DAY = 3;
const LEAGUE_TIMEZONE = "America/Toronto";
const INSERT_SCORES_COMMAND = "Insert Scores";
const INSERT_LEAGUE_SCORES_COMMAND = "Insert League Scores";
const LIFETIME_LEADERBOARD_EXPORT_PATH = "tmp/rdb-rank-leaderboard.txt";

interface ParsedSeasonArgs {
    scope: PlayerProfileScope;
    args: string[];
}

interface LeagueWeekWindow {
    start: Dayjs;
    end: Dayjs;
}

export class RDBModule implements BotModule {

    init(ctx: BotRegistrar): void | Promise<void> {

        const rest = new ContextMenuCommandBuilder()
            .setName(INSERT_SCORES_COMMAND)
            .setType(ApplicationCommandType.Message);

        ctx.addMessageCommand('rdb', this.runCommand.bind(this));
        ctx.addBotReady(this.writeLifetimeRankLeaderboardFile.bind(this));
        ctx.addMessageContextMenu(rest.toJSON(), INSERT_SCORES_COMMAND, this.messageCtxHandler.bind(this));

        const rest_league = new ContextMenuCommandBuilder()
            .setName(INSERT_LEAGUE_SCORES_COMMAND)
            .setType(ApplicationCommandType.Message);
        ctx.addMessageContextMenu(rest_league.toJSON(), INSERT_LEAGUE_SCORES_COMMAND, this.messageCtxHandler.bind(this));
    }

    async messageCtxHandler(conf: BotConfig, interaction: MessageContextMenuCommandInteraction) {
        if (!conf.writeAccess.includes(interaction.user.id)) return;
            let str = interaction.targetMessage.content;
            
            //make sure the message mentions 4 users
            // mentions.member does not recognize all pinged members - using mentions.users instead
            let mentions = interaction.targetMessage.mentions.users?.size;
            if (mentions !== 4) {
                throw new Error(`Message must mention 4 users, but found ${mentions}.`);
            }
            let splice = str.replace(/[<@!>]/g, "").split(/\s+/g);
            let gameid = interaction.targetMessage.id!

            // if (await RiichiDatabase.hasGameID(gameid)) {
            //     throw new Error(`Score already exists in database.`);
            // }
        
            // await RiichiDatabase.insertData(gameid, parseScoreFromRaw(splice));
            const cur_season = await this.getInsertSeason(interaction.commandName);
            const isLeagueSubmission = interaction.commandName === INSERT_LEAGUE_SCORES_COMMAND;
            const gameinfo = parseScoreFromRaw(splice, cur_season);
            const playerIds = gameinfo.map(player => player.id);
            const beforeLifetime = isLeagueSubmission
                ? new Map<string, LifetimePlayerState>()
                : await this.getLifetimeStateMap(playerIds);
            const beforeLeagueStandings = isLeagueSubmission
                ? await this.getSeasonAdjustedStandingMap(cur_season.season_id)
                : new Map<string, SeasonAdjustedStanding>();

            await RiichiDatabase.addGame({
                "game_id": gameid,
                "date": interaction.targetMessage.createdAt.toISOString(),
                "notes": "",
                "season_id": cur_season.season_id
            })
            for (const p of gameinfo) {
                await RiichiDatabase.addParticipant({
                    "adj_score": p.scoreAdj,
                    "game_id": gameid,
                    "placement": p.placement,
                    "raw_score": p.scoreRaw,
                    "player_id": p.id
                });
            }
            if (interaction.commandName === INSERT_SCORES_COMMAND) {
                await interaction.targetMessage.react("📥")
            } else {
                await interaction.targetMessage.react("🏆")
            }
            const embed = isLeagueSubmission
                ? this.createLeagueScoreSubmitEmbed(
                    cur_season,
                    gameinfo,
                    beforeLeagueStandings,
                    await this.getSeasonAdjustedStandingMap(cur_season.season_id),
                    interaction.client,
                )
                : this.createRegularScoreSubmitEmbed(
                    cur_season,
                    gameinfo,
                    beforeLifetime,
                    await this.getLifetimeStateMap(playerIds),
                    interaction.client,
                );
            await interaction.reply({ embeds: [embed] });
        
    }
    
    
    async runCommand(conf: BotConfig, event: Message<boolean>, args: string[]): Promise<void> {
        const is_admin = conf.writeAccess.includes(event.author.id);

        if (args[0] === "me") {
            await this.replyWithPlayerProfile(event, event.author, args.slice(1));
        } else if (args[0] === "ranks" || args[0] === "rank") {
            await this.replyWithLifetimeRanks(event, args.slice(1));
        } else if (args[0] === "game") {
            const id = this.cleanDiscordId(args[1] ?? "");
            if (!/^\d+$/.test(id)) {
                throw new Error("Invalid game id.");
            }

            const game = await RiichiDatabase.getGame(id);
            if (game === null) {
                throw new Error(`Game ${id} not found.`);
            }

            const players = await RiichiDatabase.getAllParticipants(game.game_id)
            await event.reply(`\`\`\`too lazy to implement so heres the json:\n${JSON.stringify(game)}\n${JSON.stringify(players)}\`\`\``);
        } else if (args[0] === "league") {
            if (args.length > 1) {
                throw new Error("Usage: `ron rdb league`.");
            }
            await this.replyWithLeagueLimit(event);
        } else if (is_admin && args[0] === "set_current_season") {
            await RiichiDatabase.setCurrentSeasonEnsureExists(args[1]);
            await event.reply(`set season to ${args[1]}`)
        } else if (is_admin && args[0] === "get_current_season") {
            const season = await RiichiDatabase.getCurrentSeasonEnsureExists();
            if (season === null) {
                await event.reply("current season is not set")
            } else {
                await event.reply(`current season is ${season.display_name}`)
            }
        } else if (is_admin && args[0] === "set_current_league_season") {
            await RiichiDatabase.setCurrentLeagueSeasonEnsureExists(args[1]);
            await event.reply(`set current league season to ${args[1]}`)
        } else if (is_admin && args[0] === "get_current_league_season") {
            const season = await RiichiDatabase.getCurrentLeagueSeasonEnsureExists();
            if (season === null) {
                await event.reply("current league season is not set")
            } else {
                await event.reply(`current league season is ${season.display_name}`)
            }
        } else if (is_admin && args[0] === "add_season") {
            const season = JSON.parse(args.slice(1).join(" ")) as SeasonEntry;
            await RiichiDatabase.addSeason(season);
            await event.reply(`added season ${season.display_name}`)
        } else if (is_admin && args[0] === "add_game") {
            const game = JSON.parse(args.slice(1).join(" ")) as GameEntry;
            await RiichiDatabase.addGame(game);
            await event.reply(`added game ${game.game_id}`)
        } else if (is_admin && args[0] === "add_participant") {
            const p = JSON.parse(args.slice(1).join(" ")) as ParticipantEntry;
            await RiichiDatabase.addParticipant(p);
            await event.reply(`added participant ${p.player_id} to ${p.game_id}`)
        } else if (is_admin && args[0] === "delete_game") {
            await RiichiDatabase.deleteGame(args[1]);
            await event.reply(`deleted game ${args[1]}`)
        } else if (is_admin && args[0] === "delete_season") {
            await RiichiDatabase.deleteSeason(args[1]);
            await event.reply(`deleted season ${args[1]}`)
        } else if (is_admin && args[0] === "delete_participant") {
            await RiichiDatabase.deleteParticipant(args[1], args[2]);
            await event.reply(`deleted participant ${args[1]} in ${args[2]}`)
        } else  {
            if (await this.replyWithMentionShortcut(event, args)) {
                return;
            }
            await this.replyWithLeaderboard(event, args);
        }
    }

    private async getLifetimeStateMap(playerIds: string[]): Promise<Map<string, LifetimePlayerState>> {
        const wanted = new Set(playerIds);
        const players = await RiichiDatabase.getLifetimeLeaderboard(0, Number.MAX_SAFE_INTEGER);
        return new Map(players.filter(player => wanted.has(player.player_id)).map(player => [player.player_id, player]));
    }

    private async writeLifetimeRankLeaderboardFile(_conf: BotConfig, _client: Client): Promise<void> {
        const [rankRows, statsRows] = await Promise.all([
            RiichiDatabase.getLifetimeLeaderboard(0, Number.MAX_SAFE_INTEGER),
            RiichiDatabase.getLifetimeLeaderboardStats(),
        ]);
        const statsByPlayer = new Map(statsRows.map(row => [row.player_id, row]));
        const lines = [
            `Generated\t${new Date().toISOString()}`,
            "Scope\tRegular games only; excludes league seasons ending in _L",
            "",
            [
                "No",
                "Player",
                "Rank",
                "Pts",
                "Next",
                "RA",
                "SAT",
                "SRT",
                "SAA",
                "SRA",
                "RT",
                "GT",
                "Promotions",
            ].join("\t"),
            ...rankRows.map((player, index) => {
                const stats = statsByPlayer.get(player.player_id);
                return [
                    index + 1,
                    player.player_id,
                    player.rank_name,
                    this.formatLifetimePoints(player.points),
                    player.next_rank_threshold === null ? "" : this.formatLifetimePoints(player.next_rank_threshold),
                    this.formatExportNumber(stats?.rank_average ?? player.rank_average, 2),
                    this.formatExportNumber(stats?.score_adj_total ?? player.total_adjusted_score / 1000, 1),
                    this.formatExportNumber(stats?.score_raw_total ?? 0, 1),
                    this.formatExportNumber(stats?.score_adj_average ?? player.score_adj_average, 1),
                    this.formatExportNumber(stats?.score_raw_average ?? 0, 1),
                    this.formatExportNumber(stats?.rank_total ?? player.total_placement, 0),
                    this.formatExportNumber(stats?.game_total ?? player.games, 0),
                    player.promotions,
                ].join("\t");
            }),
        ];

        mkdirSync("tmp", { recursive: true });
        writeFileSync(LIFETIME_LEADERBOARD_EXPORT_PATH, lines.join("\n"));
        console.log(`Wrote ${LIFETIME_LEADERBOARD_EXPORT_PATH}`);
    }

    private async getSeasonAdjustedStandingMap(seasonId: string): Promise<Map<string, SeasonAdjustedStanding>> {
        const standings = await RiichiDatabase.getSeasonAdjustedStandings(seasonId);
        return new Map(standings.map(standing => [standing.player_id, standing]));
    }

    private createRegularScoreSubmitEmbed(
        season: SeasonEntry,
        gameinfo: GameInfoEntry[],
        beforeLifetime: Map<string, LifetimePlayerState>,
        afterLifetime: Map<string, LifetimePlayerState>,
        client: Client,
    ): EmbedManager {
        const eb = new EmbedManager(`Recorded Game (${season.display_name})`, client);
        const promotions: string[] = [];
        const lines = gameinfo.map(player => {
            const before = beforeLifetime.get(player.id);
            const after = afterLifetime.get(player.id);
            const beforePoints = before?.points ?? 0;
            const delta = after ? after.points - beforePoints : 0;

            if (after && after.rank > (before?.rank ?? 1)) {
                promotions.push(`<@${player.id}> -> ${after.rank_name}`);
            }

            return `${player.placement} <@${player.id}> ${this.formatSignedFixed(player.scoreAdj / 1000, 1)} | ${this.formatSignedFixed(delta, 1)} -> ${after ? this.formatLifetimeRankProgressCompact(after) : "Unranked"}`;
        });

        eb.addContent(lines.join("\n"));
        if (promotions.length > 0) {
            eb.addFields({ name: "Promotions", value: promotions.join("\n"), inline: false });
        }
        return eb;
    }

    private createLeagueScoreSubmitEmbed(
        season: SeasonEntry,
        gameinfo: GameInfoEntry[],
        beforeStandings: Map<string, SeasonAdjustedStanding>,
        afterStandings: Map<string, SeasonAdjustedStanding>,
        client: Client,
    ): EmbedManager {
        const eb = new EmbedManager(`Recorded League Game (${season.display_name})`, client);
        const lines = gameinfo.map(player => {
            const before = beforeStandings.get(player.id);
            const after = afterStandings.get(player.id);
            const leagueRank = after
                ? before
                    ? before.rank !== after.rank
                        ? `#${before.rank} -> #${after.rank}`
                        : `#${after.rank}`
                    : `N/A -> #${after.rank}`
                : "N/A";
            const leagueTotal = after ? this.formatSignedFixed(after.score_adj_total, 1) : "N/A";

            return `${player.placement}${this.ordinalSuffix(player.placement)} <@${player.id}> | ${this.formatSignedFixed(player.scoreAdj / 1000, 1)} | ${leagueRank} | total ${leagueTotal}`;
        });
        eb.addContent(lines.join("\n"));
        return eb;
    }

    private formatLifetimeRankProgressCompact(player: LifetimePlayerState): string {
        const points = this.formatLifetimePoints(player.points);
        if (player.next_rank_threshold === null) {
            return `${player.rank_name} ${points}`;
        }
        return `${player.rank_name} ${points}/${player.next_rank_threshold}`;
    }

    private formatLifetimePoints(points: number): string {
        return points.toFixed(1).replace(/\.0$/, "");
    }

    private formatExportNumber(value: number, digits: number): string {
        return value.toFixed(digits);
    }

    private async replyWithPlayerProfile(event: Message<boolean>, user: Message<boolean>["author"], args: string[]): Promise<void> {
        const parsed = await this.parseSeasonScope(args);
        if (parsed.args.length > 0) {
            throw new Error(`Unexpected argument(s): ${parsed.args.join(" ")}`);
        }

        const [embed, files] = await playerProfileCreator(parsed.scope, user);
        await event.reply({ embeds: [embed], files });
    }

    private async replyWithMentionShortcut(event: Message<boolean>, args: string[]): Promise<boolean> {
        const parsed = await this.parseSeasonScope(args);
        const mentionArgs = parsed.args.filter(arg => this.isDiscordMention(arg));

        if (mentionArgs.length === 0) {
            return false;
        }
        if (mentionArgs.length !== parsed.args.length) {
            throw new Error("Usage: `ron rdb @player` or `ron rdb @player1 @player2`, plus optional season selector.");
        }
        if (mentionArgs.length === 1) {
            await this.replyWithPlayerProfileById(event, parsed.scope, mentionArgs[0]);
            return true;
        }
        if (mentionArgs.length === 2) {
            await this.replyWithPlayerComparison(event, args);
            return true;
        }

        throw new Error("Use one mention for a profile or two mentions for a comparison.");
    }

    private async replyWithPlayerProfileById(event: Message<boolean>, scope: PlayerProfileScope, idArg: string): Promise<void> {
        const id = this.cleanDiscordId(idArg);
        if (!/^\d+$/.test(id)) {
            throw new Error("Invalid player id or mention.");
        }

        const user = await event.client.users.fetch(id).catch(() => null);
        if (!user) {
            throw new Error("User not found.");
        }

        const [embed, files] = await playerProfileCreator(scope, user);
        await event.reply({ embeds: [embed], files });
    }

    private async replyWithPlayerComparison(event: Message<boolean>, args: string[]): Promise<void> {
        const parsed = await this.parseSeasonScope(args);
        let player1Id: string;
        let player2Id: string;

        if (parsed.args.length === 1) {
            player1Id = event.author.id;
            player2Id = this.cleanDiscordId(parsed.args[0]);
        } else if (parsed.args.length === 2) {
            player1Id = this.cleanDiscordId(parsed.args[0]);
            player2Id = this.cleanDiscordId(parsed.args[1]);
        } else {
            throw new Error("Usage: `ron rdb @player1 @player2`, plus optional season selector.");
        }

        if (!/^\d+$/.test(player1Id) || !/^\d+$/.test(player2Id)) {
            throw new Error("Invalid player id or mention.");
        }
        if (player1Id === player2Id) {
            throw new Error("Choose two different players to compare.");
        }

        const stats = await RiichiDatabase.getPlayerComparison(parsed.scope.season_id, player1Id, player2Id);
        const eb = new EmbedManager(`Shared Games (${parsed.scope.display_name})`, event.client);
        if (stats === null) {
            eb.addContent(`<@${player1Id}> and <@${player2Id}> have no shared games in this season scope.`);
            await event.reply({ embeds: [eb] });
            return;
        }

        const recentGames = await RiichiDatabase.getRecentPlayerComparisonGames(parsed.scope.season_id, player1Id, player2Id, 5);
        const games = stats.games_played_together;
        const formatScore = (score: number) => {
            const value = (score / 1000).toFixed(1);
            return score > 0 ? `+${value}` : value;
        };
        const formatAverageScore = (score: number) => formatScore(score / games);
        const formatAverageRaw = (score: number) => (score / games).toFixed(0);
        const formatAveragePlacement = (placementTotal: number) => (placementTotal / games).toFixed(2);

        eb.addFields(
            {
                name: "Summary",
                value: [
                    `Shared games: ${games}`,
                    `Placement wins: <@${player1Id}> ${stats.player1_wins} - ${stats.player2_wins} <@${player2Id}>`,
                    `Adj delta: ${formatScore(stats.player1_adj_total - stats.player2_adj_total)} for <@${player1Id}>`,
                ].join("\n"),
                inline: false,
            },
            {
                name: "Player 1",
                value: [
                    `<@${player1Id}>`,
                    `Adj total: ${formatScore(stats.player1_adj_total)}`,
                    `Adj avg: ${formatAverageScore(stats.player1_adj_total)}`,
                    `Raw avg: ${formatAverageRaw(stats.player1_raw_total)}`,
                    `Avg place: ${formatAveragePlacement(stats.player1_placement_total)}`,
                    `Placements: ${stats.player1_firsts}/${stats.player1_seconds}/${stats.player1_thirds}/${stats.player1_fourths}`,
                ].join("\n"),
                inline: true,
            },
            {
                name: "Player 2",
                value: [
                    `<@${player2Id}>`,
                    `Adj total: ${formatScore(stats.player2_adj_total)}`,
                    `Adj avg: ${formatAverageScore(stats.player2_adj_total)}`,
                    `Raw avg: ${formatAverageRaw(stats.player2_raw_total)}`,
                    `Avg place: ${formatAveragePlacement(stats.player2_placement_total)}`,
                    `Placements: ${stats.player2_firsts}/${stats.player2_seconds}/${stats.player2_thirds}/${stats.player2_fourths}`,
                ].join("\n"),
                inline: true,
            },
        );

        if (recentGames.length > 0) {
            const formatDate = (date: string) => {
                const d = new Date(date);
                const month = `${d.getMonth() + 1}`.padStart(2, "0");
                const day = `${d.getDate()}`.padStart(2, "0");
                return `${month}/${day}`;
            };
            const formatResult = (placement: number, adjScore: number) => `${placement}${this.ordinalSuffix(placement)} ${formatScore(adjScore)}`;
            const historyRows = [
                ["Date", "P1", "P2"],
                ...recentGames.map(game => [
                    formatDate(game.date),
                    formatResult(game.player1_placement, game.player1_adj_score),
                    formatResult(game.player2_placement, game.player2_adj_score),
                ]),
            ];
            const widths = [5, 10, 10];
            const history = historyRows
                .map(row => row.map((cell, index) => cell.padEnd(widths[index])).join("  ").trimEnd())
                .join("\n");

            eb.addFields({
                name: "Recent Shared Games",
                value: `\`\`\`\n${history}\n\`\`\``,
                inline: false,
            });
        }

        await event.reply({ embeds: [eb] });
    }

    private async replyWithLeagueLimit(event: Message<boolean>): Promise<void> {
        const season = await this.getCurrentLeagueSeasonOrThrow();
        const window = this.getLeagueWeekWindow();
        const rows = await RiichiDatabase.getAllPlayerGameCountsInSeasonWindow(
            season.season_id,
            window.start.toISOString(),
            window.end.toISOString(),
        );

        const lines = rows.map(row => {
            const gamesUsed = row.game_total;
            const gamesLeft = Math.max(0, LEAGUE_WEEKLY_GAME_LIMIT - gamesUsed);
            const status = gamesLeft === 0 ? "capped" : `${gamesLeft} left`;
            return `<@${row.player_id}>: ${gamesUsed}/${LEAGUE_WEEKLY_GAME_LIMIT} used (${status})`;
        });

        const formatWindowDate = (date: Dayjs) => date.format("ddd MMM D, h:mm A");
        const eb = new EmbedManager(`League Limit (${season.display_name})`, event.client);
        if (lines.length === 0) {
            eb.addContent("No league games found in the current reset window.");
            await event.reply({ embeds: [eb] });
            return;
        }

        eb.addContent([
            `Window: ${formatWindowDate(window.start)} to ${formatWindowDate(window.end)} (${LEAGUE_TIMEZONE})`,
            `Limit: ${LEAGUE_WEEKLY_GAME_LIMIT} games per player`,
            "",
            ...lines,
        ].join("\n"));
        await event.reply({ embeds: [eb] });
    }

    private getLeagueWeekWindow(now = new Date()): LeagueWeekWindow {
        const localNow = dayjs(now).tz(LEAGUE_TIMEZONE);
        const daysSinceReset = (localNow.day() - LEAGUE_WEEK_START_DAY + 7) % 7;
        const start = localNow.startOf("day").subtract(daysSinceReset, "day");
        return {
            start,
            end: start.add(7, "day"),
        };
    }

    private async replyWithLifetimeRanks(event: Message<boolean>, args: string[]): Promise<void> {
        let amount = DEFAULT_LIFETIME_RANK_AMOUNT;

        for (const arg of args) {
            if (arg === "all") {
                amount = MAX_LIFETIME_RANK_AMOUNT;
                continue;
            }
            if (!Number.isNaN(Number(arg)) && Number.isInteger(Number(arg))) {
                amount = Number(arg);
                continue;
            }
            throw new Error("Usage: `ron rdb ranks [amount]` or `ron rdb ranks all`.");
        }

        if (amount < 1) {
            throw new Error("Lifetime rank amount must be at least 1.");
        }
        amount = Math.min(amount, MAX_LIFETIME_RANK_AMOUNT);

        const data = await RiichiDatabase.getLifetimeLeaderboard(0, amount);
        const title = "Lifetime Ranks";
        if (data.length === 0) {
            const eb = new EmbedManager(title, event.client).addContent("No RiichiDB games found.");
            await event.reply({ embeds: [eb] });
            return;
        }

        const header = "No. | Player | Pts";
        const chunks = this.formatLifetimeRankChunks(data, header, MAX_EMBED_DESCRIPTION_LENGTH);
        const embeds = chunks.map((chunk, index) =>
            new EmbedManager(index === 0 ? title : `${title} (${index + 1})`, event.client).addContent(chunk)
        );

        await event.reply({ embeds });
    }

    private async replyWithLeaderboard(event: Message<boolean>, args: string[]): Promise<void> {
        const parsed = await this.parseSeasonScope(args);
        let leaderboardArgs = parsed.args;

        if (leaderboardArgs.length === 0) {
            leaderboardArgs = ["sat"];
        }
        let amount = DEFAULT_LEADERBOARD_AMOUNT;
        let amountProvided = false;
        let selectedStats: LeaderboardStatKey[] = [];
        let desktopRequested = false;

        const acronyms: Record<string, LeaderboardStatKey> = {
            "ra": "rank_average",
            "sat": "score_adj_total",
            "srt": "score_raw_total",
            "saa": "score_adj_average",
            "sra": "score_raw_average",
            "gt": "game_total"
        }
        const validStatArgs = Object.keys(acronyms).join(", ");

        const headerData: Record<LeaderboardStatKey, Header> = {
            "rank_average": {k: "rank_average", l: "Avg Rank", t: "decimal" },
            "score_adj_total": {k: "score_adj_total", l: "Adj Total", t: "score" },
            "score_raw_total": {k: "score_raw_total", l: "Raw Total", t: "score" },
            "score_adj_average": {k: "score_adj_average", l: "Adj Avg", t: "score" },
            "score_raw_average": {k: "score_raw_average", l: "Raw Avg", t: "score" },
            "game_total": {k: "game_total", l: "Games", t: "integer" },
            "rank_total": {k: "rank_total", l: "Rank Total", t: "integer" }
        }
        const addSelectedStat = (key: LeaderboardStatKey) => {
            if (!selectedStats.includes(key)) {
                selectedStats.push(key);
            }
        };

        for (let i = 0; i < leaderboardArgs.length; i++) {
            if (leaderboardArgs[i] === "-d" || leaderboardArgs[i] === "--desktop") {
                desktopRequested = true;
            } else if (!isNaN(Number(leaderboardArgs[i])) && Number.isInteger(Number(leaderboardArgs[i]))) {
                amount = Number(leaderboardArgs[i]);
                amountProvided = true;
            } else if (leaderboardArgs[i] in acronyms) {
                const key = acronyms[leaderboardArgs[i]];
                addSelectedStat(key);
            } else if (leaderboardArgs[i] in headerData) {
                const key = leaderboardArgs[i] as LeaderboardStatKey;
                addSelectedStat(key);
            } else if (leaderboardArgs[i].startsWith("-")) {
                throw new Error(`Unknown leaderboard option: ${leaderboardArgs[i]}. Use bare stat names like \`saa -l\`, not \`-saa -l\`.`);
            } else {
                throw new Error(`Unknown leaderboard argument: ${leaderboardArgs[i]}. Valid stats: ${validStatArgs}.`);
            }
        }

        if (selectedStats.length === 0) {
            addSelectedStat(acronyms["sat"]);
        }

        let mobile = !desktopRequested;
        if (desktopRequested && amount > MAX_FIELD_LEADERBOARD_AMOUNT) {
            if (amountProvided) {
                mobile = true;
            } else {
                amount = MAX_FIELD_LEADERBOARD_AMOUNT;
            }
        }
        if (mobile && amount > MAX_MOBILE_LEADERBOARD_AMOUNT) {
            amount = MAX_MOBILE_LEADERBOARD_AMOUNT;
        }

        const headers: Header[] = [
            {k: "rank", l: "Rank", t: "string"},
            {k: "id_player", l: "Player", t: "mention"},
            ...selectedStats.map(key => headerData[key]),
        ];
        const data = await RiichiDatabase.getLeaderboard(0, amount, parsed.scope.season_id, selectedStats[0]);
        const lbdata = data.map((e, i) => {
            const row: Record<string, string | number> = {
                "id_player": e.player_id,
                "rank": i + 1,
            };
            for (const key of selectedStats) {
                row[key] = e[key];
            }
            return row;
        })

        const eb = new EmbedManager(`Leaderboard (${parsed.scope.display_name})`, event.client);
        if (lbdata.length === 0) {
            eb.addContent("No games found for this season scope.");
            await event.reply({ embeds: [eb] });
            return;
        }

        if (mobile) {
            eb.addObjectArrayToMobile(headers, lbdata);
        } else {
            eb.addObjectArrayToField(headers, lbdata);
        }
        await event.reply({ embeds: [eb] });
    }

    private async getInsertSeason(commandName: string): Promise<SeasonEntry> {
        if (commandName === INSERT_LEAGUE_SCORES_COMMAND) {
            const season = await RiichiDatabase.getCurrentLeagueSeasonEnsureExists();
            if (season === null) {
                throw new Error("Current RiichiDB league season is not set. Run `ron rdb set_current_league_season S26_L`.");
            }
            return season;
        }

        const season = await RiichiDatabase.getCurrentSeasonEnsureExists();
        if (season === null) {
            throw new Error("current season is invalid/not set");
        }
        return season;
    }

    private async parseSeasonScope(args: string[]): Promise<ParsedSeasonArgs> {
        let selectorType: SeasonSelectorType = "default";
        let selectedSeasonId = "";
        const remaining: string[] = [];

        const setSelector = (type: SeasonSelectorType, seasonId = "") => {
            if (selectorType !== "default") {
                throw new Error("Use only one season selector.");
            }
            selectorType = type;
            selectedSeasonId = seasonId;
        }

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === "--all" || arg === "-a") {
                setSelector("all");
            } else if (arg === "--current" || arg === "-c") {
                setSelector("current");
            } else if (arg === "--league" || arg === "-l") {
                setSelector("league");
            } else if (arg === "--season" || arg === "-s") {
                const seasonId = args[++i];
                if (!seasonId) {
                    throw new Error(`Missing season id after ${arg}.`);
                }
                setSelector("season", seasonId);
            } else if (arg.startsWith("--season=")) {
                const seasonId = arg.slice("--season=".length);
                if (!seasonId) {
                    throw new Error("Missing season id after --season=.");
                }
                setSelector("season", seasonId);
            } else {
                remaining.push(arg);
            }
        }

        if (selectorType === "default" || selectorType === "league") {
            const season = await this.getCurrentLeagueSeasonOrThrow();
            return {
                scope: { season_id: season.season_id, display_name: season.display_name },
                args: remaining,
            };
        }

        if (selectorType === "all") {
            return {
                scope: { season_id: null, display_name: "All Seasons" },
                args: remaining,
            };
        }

        if (selectorType === "current") {
            const season = await this.getCurrentSeasonOrThrow();
            return {
                scope: { season_id: season.season_id, display_name: season.display_name },
                args: remaining,
            };
        }

        const season = await RiichiDatabase.getSeason(selectedSeasonId);
        if (season === null) {
            throw new Error(`Unknown RiichiDB season: ${selectedSeasonId}.`);
        }

        return {
            scope: { season_id: season.season_id, display_name: season.display_name },
            args: remaining,
        };
    }

    private async getCurrentSeasonOrThrow(): Promise<SeasonEntry> {
        const season = await RiichiDatabase.getCurrentSeasonEnsureExists();
        if (season === null) {
            throw new Error("Current RiichiDB season is not set. Run `npm run migrate:rdb`, then `ron rdb set_current_season S26`.");
        }
        return season;
    }

    private async getCurrentLeagueSeasonOrThrow(): Promise<SeasonEntry> {
        const season = await RiichiDatabase.getCurrentLeagueSeasonEnsureExists();
        if (season === null) {
            throw new Error("Current RiichiDB league season is not set. Run `ron rdb set_current_league_season S26_L`.");
        }
        return season;
    }

    private formatLifetimeRankChunks(
        players: LifetimePlayerState[],
        header: string,
        maxLength: number,
    ): string[] {
        const chunks: string[] = [];
        let current = header;
        let previousRank = "";

        const appendLine = (line: string, rankName?: string) => {
            const next = `${current}\n${line}`;
            if (next.length > maxLength && current !== header) {
                chunks.push(current);
                current = rankName ? `${header}\n${rankName}\n${line}` : `${header}\n${line}`;
            } else {
                current = next;
            }
        };

        players.forEach((player, index) => {
            if (player.rank_name !== previousRank) {
                appendLine(`**${player.rank_name}** (${this.formatLifetimeRankRange(player)})`);
                previousRank = player.rank_name;
            }

            appendLine([
                String(index + 1),
                `<@${player.player_id}>`,
                this.formatLifetimePoints(player.points),
            ].join(" | "), player.rank_name);
        });

        if (current.length > 0) {
            chunks.push(current);
        }

        return chunks;
    }

    private formatLifetimeRankRange(player: LifetimePlayerState): string {
        const floor = this.formatLifetimePoints(player.floor);
        if (player.next_rank_threshold === null) {
            return `${floor}+ pts`;
        }
        return `${floor}-${player.next_rank_threshold} pts`;
    }

    private formatSignedFixed(value: number, digits: number): string {
        const formatted = value.toFixed(digits);
        return value > 0 ? `+${formatted}` : formatted;
    }

    private cleanDiscordId(id: string): string {
        return id.replace(/[<@!>]/g, "");
    }

    private isDiscordMention(value: string): boolean {
        return /^<@!?\d+>$/.test(value);
    }

    private ordinalSuffix(value: number): string {
        if (value === 1) return "st";
        if (value === 2) return "nd";
        if (value === 3) return "rd";
        return "th";
    }

}


