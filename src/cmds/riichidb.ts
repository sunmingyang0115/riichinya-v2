import { Message } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder, ExpectedType } from "../data/doc_manager";
import { EmbedManager, Header } from "../data/embed_manager";
import { playerProfileCreator, type PlayerProfileScope } from "../templates/playerProfile";
import { RiichiDatabase } from "./riichidb/sql_db2";
import { GameEntry, ParticipantEntry, SeasonEntry } from "./riichidb/db_struct";
import BotProperties from "../../bot_properties.json"

type SeasonSelectorType = "all" | "current" | "season";
const DEFAULT_LEADERBOARD_AMOUNT = 30;
const MAX_FIELD_LEADERBOARD_AMOUNT = 40;
const MAX_MOBILE_LEADERBOARD_AMOUNT = 100;

interface ParsedSeasonArgs {
    scope: PlayerProfileScope;
    args: string[];
}

export class RiichiDbCommand implements CommandBuilder {
    getDocumentation(): string {
        return new DocBuilder()
            .addSingleSubCom("ron", ExpectedType.LITERAL, "")
            .addSingleSubCom("rdb", ExpectedType.LITERAL, "")
            .beginMultiSubCom("--current|-c")
            .insertMultiSubCom(ExpectedType.LITERAL, "use the configured current season")
            .back()
            .beginMultiSubCom("--season|-s")
            .insertMultiSubCom(ExpectedType.TEXT, "use a specific season id")
            .back()
            .beginMultiSubCom("me")
            .insertMultiSubCom(ExpectedType.LITERAL, "show your player profile")
            .back()
            .beginMultiSubCom("player")
            .insertMultiSubCom(ExpectedType.TEXT, "show a player profile by mention or id")
            .back()
            .beginMultiSubCom("game")
            .insertMultiSubCom(ExpectedType.DECIMAL, "show game data")
            .back()
            .addExampleDoc("ron rdb", "all-season leaderboard", "defaults to all seasons")
            .addExampleDoc("ron rdb --current", "current-season leaderboard", "long flag")
            .addExampleDoc("ron rdb -s F25_2", "Fall 2025 Split 2 leaderboard", "short season flag")
            .addExampleDoc("ron rdb me -c", "current-season profile", "profile with short current flag")
            .addExampleDoc("ron rdb player @user --season F25_2", "specific player profile", "profile with long season flag")
            .build();
    }

    getCommandName(): string {
        return "rdb"
    }

    getCooldown(): number {
        return 10;
    }

    async runCommand(event: Message<boolean>, args: string[]): Promise<void> {
        const is_admin = BotProperties.writeAccess.includes(event.author.id);

        if (args[0] === "me") {
            await this.replyWithPlayerProfile(event, event.author, args.slice(1));
        } else if (args[0] === "player") {
            const parsed = await this.parseSeasonScope(args.slice(1));
            const idArg = parsed.args[0];
            if (!idArg) {
                throw new Error("Missing player id or mention.");
            }
            if (parsed.args.length > 1) {
                throw new Error(`Unexpected argument(s): ${parsed.args.slice(1).join(" ")}`);
            }

            const id = this.cleanDiscordId(idArg);
            if (!/^\d+$/.test(id)) {
                throw new Error("Invalid player id.");
            }

            const user = await event.client.users.fetch(id).catch(() => null);
            if (!user) {
                throw new Error("User not found.");
            }

            const [embed, files] = await playerProfileCreator(parsed.scope, user);
            await event.reply({ embeds: [embed], files });
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

    private async replyWithLeaderboard(event: Message<boolean>, args: string[]): Promise<void> {
        const parsed = await this.parseSeasonScope(args);
        let leaderboardArgs = parsed.args;

        if (leaderboardArgs.length === 0) {
            leaderboardArgs = ["sat"];
        }
        if (leaderboardArgs.length === 1 && leaderboardArgs[0] === "m") {
            leaderboardArgs = ["sat", "m"];
        }

        let amount = DEFAULT_LEADERBOARD_AMOUNT;
        let headers: Header[] = [];
        let mobile = false;

        const acronyms: Record<string, string> = {
            "ra": "rank_average",
            "sat": "score_adj_total",
            "srt": "score_raw_total",
            "saa": "score_adj_average",
            "sra": "score_raw_average",
            "gt": "game_total"
        }

        const headerData: Record<string, Header> = {
            "rank_average": {k: "", l: "Average Rank", t: "number" },
            "score_adj_total": {k: "", l: "Score (Adjusted)", t: "score" },
            "score_raw_total": {k: "", l: "Score (Raw)", t: "score" },
            "score_adj_average": {k: "", l: "Score (Adjusted Average)", t: "score" },
            "score_raw_average": {k: "", l: "Score (Raw Average)", t: "score" },
            "game_total": {k: "", l: "Games Played (Total)", t: "number" },
            "rank_total": {k: "", l: "Rank Total", t: "number" }
        }

        for (let i = 0; i < leaderboardArgs.length; i++) {
            if (leaderboardArgs[i] === "m") {
                mobile = true;
            } else if (!isNaN(Number(leaderboardArgs[i])) && Number.isInteger(Number(leaderboardArgs[i]))) {
                amount = Number(leaderboardArgs[i]);
            } else if (leaderboardArgs[i] in acronyms) {
                const key = acronyms[leaderboardArgs[i]];
                headers.push({ k: key, l: headerData[key].l, t: headerData[key].t });
            } else if (leaderboardArgs[i] in headerData) {
                const key = leaderboardArgs[i] as string;
                headers.push({ k: key, l: headerData[key].l, t: headerData[key].t });
            }
        }

        if (headers.length === 0) {
            const key = acronyms["sat"];
            headers.push({ k: key, l: headerData[key].l, t: headerData[key].t });
        }

        if (!mobile && amount > MAX_FIELD_LEADERBOARD_AMOUNT) {
            mobile = true;
        }
        if (mobile && amount > MAX_MOBILE_LEADERBOARD_AMOUNT) {
            amount = MAX_MOBILE_LEADERBOARD_AMOUNT;
        }

        const data = await RiichiDatabase.getLeaderboard(0, amount, parsed.scope.season_id);
        const lbdata = data.map((e, i) => ({
            "id_player": e.player_id,
            "rank": i + 1,
            "score_adj_total": e.score / 1000.0
        }))

        const eb = new EmbedManager(`Leaderboard (${parsed.scope.display_name})`, event.client);
        if (lbdata.length === 0) {
            eb.addContent("No games found for this season scope.");
            await event.reply({ embeds: [eb] });
            return;
        }

        headers.unshift({k: "id_player", l: "Player", t: "mention"});
        headers.unshift({k: "rank", l: "Rank", t: "string"});

        if (mobile) {
            eb.addObjectArrayToMobile(headers, lbdata);
        } else {
            eb.addObjectArrayToField(headers, lbdata);
        }
        await event.reply({ embeds: [eb] });
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

    private cleanDiscordId(id: string): string {
        return id.replace(/[<@!>]/g, "");
    }
}
