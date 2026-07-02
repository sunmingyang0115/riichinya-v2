import { Message, Client, AttachmentBuilder, Collection, MessageContextMenuCommandInteraction, MessageFlags, ContextMenuCommandBuilder, ApplicationCommandType } from "discord.js";
import { DocBuilder, ExpectedType } from "../data/doc_manager";
import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
// import { DataGameSQLEntry, DataPlayerSQLEntry, playerDataAttr, RiichiDatabase } from "./riichidb/sql_db2";
import { parseScoreFromRaw } from "./riichidb/score_parser2";
import { EmbedManager, Header } from "../data/embed_manager";
import { parse } from "json2csv";
import { playerProfileCreator, PlayerProfileScope } from "../templates/playerProfile";
import { RiichiDatabase } from "./riichidb/sql_db2";
import { GameEntry, ParticipantEntry, SeasonEntry } from "./riichidb/db_struct";
import { LeaderboardStatKey } from "./riichidb/query_struct";
import BotProperties from "../../bot_properties.json"
import { BotModule } from "../data/bot_module";
import { BotRegistrar } from "../data/bot_registrar";
import { BotConfig } from "../data/bot_config";

dayjs.extend(utc);
dayjs.extend(timezone);

type SeasonSelectorType = "all" | "current" | "league" | "season";
const DEFAULT_LEADERBOARD_AMOUNT = 50;
const MAX_FIELD_LEADERBOARD_AMOUNT = 40;
const MAX_MOBILE_LEADERBOARD_AMOUNT = 100;
const LEAGUE_WEEKLY_GAME_LIMIT = 2;
const LEAGUE_WEEK_START_DAY = 3;
const LEAGUE_TIMEZONE = "America/Toronto";
const INSERT_SCORES_COMMAND = "Insert Scores";
const INSERT_LEAGUE_SCORES_COMMAND = "Insert League Scores";

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
            let content = `Successful id:${gameid} (${cur_season.display_name})`;
            const gameinfo = parseScoreFromRaw(splice, cur_season);
            console.log(gameinfo.length)
            // add scores
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
            await interaction.reply({
                embeds : [new EmbedManager("rdb", interaction.client).addContent(content)],
                flags: MessageFlags.Ephemeral
            });
        
    }
    
    
    async runCommand(conf: BotConfig, event: Message<boolean>, args: string[]): Promise<void> {
        const is_admin = conf.writeAccess.includes(event.author.id);

        if (args[0] === "me") {
            await this.replyWithPlayerProfile(event, event.author, args.slice(1));
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
        let selectorType: SeasonSelectorType = "all";
        let selectedSeasonId = "";
        const remaining: string[] = [];

        const setSelector = (type: SeasonSelectorType, seasonId = "") => {
            if (selectorType !== "all") {
                throw new Error("Use only one season selector.");
            }
            selectorType = type;
            selectedSeasonId = seasonId;
        }

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === "--current" || arg === "-c") {
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

        if (selectorType === "league") {
            const season = await this.getCurrentLeagueSeasonOrThrow();
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


