import { DocBuilder, ExpectedType } from "../data/doc_manager";
import { CommandBuilder } from "../data/cmd_manager";
import { EmbedManager } from "../data/embed_manager";
import {
	bold,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
	ComponentType,
	EmbedBuilder,
	inlineCode,
	Message,
	spoiler,
} from "discord.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import BotProperties from "../../bot_properties.json";
import dayjs from "dayjs";
import sharp from "sharp";
import { analyzeWWYDSituation, WwydAnalysisResult } from "./wwyd/mahjong_api";

export const WWYD_DATA_PATH = "wwydData.json";
export const START_DATE = dayjs("2025-03-16");

export type GuildMap = {
	[guildId: string]: {
		channelId: string;
		players: {
			[userId: string]: {
				attempts: number;
				correct: number;
				datesAttempted: string[];
			};
		};
		currentMessageId: string;
		dates: {
			[date: string]: {
				[tile: string]: number;
			};
		};
	};
};

type Wwyd = {
	seat: "E" | "S" | "W" | "N";
	round: "E" | "S";
	turn: string;
	indicator: string;
	hand: string[];
	draw: string;
	answer: string;
	comment: (string | string[])[];
};

/**
 * Convert a timestamp to the WWYD "day" by pivoting at 10:00 local time.
 * If time is before 10:00, it belongs to the previous calendar day.
 */
export const toWwydDate = (now: dayjs.Dayjs) => {
	return now.hour() < 10 ? now.subtract(1, "day") : now;
};

/**
 * Reads the channel data from disk, perform an operation via cb, then write the result to disk.
 * Use json file as a makeshift database to store which channels should be sent daily WWYD's.
 *
 * @param cb Callback to run on the retrieved data
 */
export const modifyWwydData = (cb: (data: GuildMap) => GuildMap) => {
	if (!existsSync(WWYD_DATA_PATH)) {
		writeFileSync(WWYD_DATA_PATH, "{}");
	}
	const data = JSON.parse(readFileSync(WWYD_DATA_PATH, "utf-8"));
	const modifiedData = cb(data);
	writeFileSync(WWYD_DATA_PATH, JSON.stringify(modifiedData, null, 2), "utf-8");
};

export const getLeaderboard = (guildId: string) => {
	if (!existsSync(WWYD_DATA_PATH)) {
		return {};
	}
	const data = JSON.parse(readFileSync(WWYD_DATA_PATH, "utf-8"));
	return data[guildId]?.players || {};
};

/**
 * Get the wwyd based on a date using the START_DATE constant.
 */
export const getWwyd = (wwyds: Wwyd[], date: dayjs.Dayjs) => {
	// date provided may be any time; adjust to WWYD day (10:00 boundary)
	const wwydDate = toWwydDate(date);
	let index = wwydDate.diff(START_DATE, "day");
	if (index < 0) index = 0;
	if (index >= wwyds.length) index = wwyds.length - 1; // simple clamp
	return { wwyd: wwyds[index], date: wwydDate, index };
};

export class WwydCommand implements CommandBuilder {
	getDocumentation(): string {
		return new DocBuilder()
			.addSingleSubCom("ron", ExpectedType.LITERAL, "")
			.addSingleSubCom("wwyd", ExpectedType.LITERAL, "")
			.addSingleSubCom("today", ExpectedType.LITERAL, "Get today's wwyd")
			.back()
			.addSingleSubCom("random", ExpectedType.LITERAL, "Get random wwyd")
			.back()
			.addSingleSubCom(
				"leaderboard",
				ExpectedType.LITERAL,
				"Show WWYD leaderboard for this server"
			)
			.addSingleSubCom(
				"topN",
				ExpectedType.INTEGER,
				"Optional: number of rows (default 10)"
			)
			.back()
			.addSingleSubCom("enable", ExpectedType.LITERAL, "")
			.addSingleSubCom(
				"channelId",
				ExpectedType.INTEGER,
				"Channel id to enable daily WWYD's in."
			)
			.back()
			.addSingleSubCom("disable", ExpectedType.LITERAL, "Disable daily WWYD")
			.build();
	}
	getCommandName(): string {
		return "wwyd";
	}
	getCooldown(): number {
		return 0;
	}

	async runCommand(event: Message<boolean>, args: string[]) {
		const eb = new EmbedManager(this.getCommandName(), event.client);

		if (args.length === 0) {
			eb.addContent(
				`Available commands are ${["random", "enable", "disable", "lb"]
					.map((cmd) => inlineCode(cmd))
					.join(", ")}.`
			);
			event.reply({ embeds: [eb] });
			return;
		}

		if (["enable", "disable", "testtoday"].includes(args[0])) {
			if (!BotProperties.writeAccess.includes(event.author.id)) {
				return;
			}
		}

		if (args[0] === "enable") {
			const channelId = event.channel.id;

			if (event.guildId && event.guild!.channels.cache.get(channelId)) {
				modifyWwydData((data: GuildMap) => {
					if (!data[event.guildId as string]) {
						data[event.guildId as string] = {
							channelId,
							players: {},
							currentMessageId: "",
							dates: {},
						};
					} else {
						data[event.guildId as string].channelId = channelId;
					}

					return data;
				});
				eb.addContent(
					`Enabled sending daily WWYD's in <#${channelId}> at 10am every day.`
				);
			} else {
				eb.addContent(`Channel does not exist.`);
			}
			event.reply({ embeds: [eb] });
		} else if (args[0] === "disable") {
			if (event.guildId) {
				modifyWwydData((data: GuildMap) => {
					if (data[event.guildId as string]) {
						eb.addContent(`Disabled sending daily WWYD's.`);
						data[event.guildId as string].channelId = "";
					} else {
						eb.addContent(`Daily WWYD's were not enabled in this server.`);
					}
					return data;
				});
			}
			event.reply({ embeds: [eb] });
		} else if (args[0] === "random") {
			const analysisEmbed = new EmbedBuilder();
			const files = await prepareWwydEmbed(eb, analysisEmbed, 2);
			event.reply({ embeds: [eb, analysisEmbed], files });
		} else if (args[0] === "testtoday") {
			// Test command to preview today's WWYD without waiting for cron
			// Using buildDailyWwydMessage to simulate the daily message with buttons
			const { embeds, files, components } = await buildDailyWwydMessage(eb);
			event.reply({ embeds, files, components });
		} else if (args[0] === "leaderboard" || args[0] === "lb") {
			if (!event.guildId) {
				eb.addContent("This command can only be used in a server.");
				event.reply({ embeds: [eb] });
				return;
			}

			const topN = 100
			const lb = getLeaderboard(event.guildId);

			const users = Object.keys(lb).map((user) => {
				const u = lb[user] || { attempts: 0, correct: 0 };
				const attempts = u.attempts ?? 0;
				const correct = u.correct ?? 0;
				const accuracy = attempts > 0 ? correct / attempts : 0;
				return { uid: user, attempts, correct, accuracy };
			});

			users.sort((a, b) => {
				if (b.correct !== a.correct) return b.correct - a.correct; // more correct first
				return b.accuracy - a.accuracy; // higher accuracy
			});

			const top = users.slice(0, topN).filter((u) => u.accuracy >= 0.5);

			if (top.length === 0) {
				eb.addContent("No leaderboard data yet. Solve some daily WWYDs!");
				eb.setFooter({ text: "Only users with at least 50% accuracy are shown." });
				event.reply({ embeds: [eb] });
				return;
			}
			const lines: string[] = [];
			let rank = 1;
			for (const row of top) {
				const member = event.guild?.members.cache.get(row.uid);
				const name = `<@${row.uid}>`;
				lines.push(
					`${rank}. ${name} — ${row.correct} pts • ${row.attempts} attempts • ${(
						row.accuracy * 100
					).toFixed(1)}%`
				);
				rank++;
			}

			eb.setTitle("WWYD Leaderboard");
			eb.addContent(lines.join("\n"));
			eb.setFooter({ text: "Only users with at least 50% accuracy are shown." });
			event.reply({ embeds: [eb] });
		}
	}
}

/**
 * Generate an image to represent the WWYD problem.
 *
 * @param wwyd WWYD object to generate image for,
 * @returns Image in the form of a Buffer object
 */
const generateWwydComposite = async (wwyd: Wwyd): Promise<Buffer> => {
	const HEADER_HEIGHT = 75;
	const TILE_WIDTH = 80;
	const TILE_GAP = 20;
	const TILE_HEIGHT = 129;
	const DORA_WIDTH = 35;

	const { round, seat, turn, indicator, hand, draw } = wwyd;

	const tiles = [...hand, draw].map((tile) => `assets/ui/${tile}.png`);

	// Draw the main 14 tiles with a gap between the tsumo tile and hand
	const composite: any[] = tiles.map((image, index) => ({
		input: image,
		left: index === tiles.length - 1 ? index * TILE_WIDTH + TILE_GAP : index * TILE_WIDTH,
		top: HEADER_HEIGHT,
		width: TILE_WIDTH,
		height: TILE_HEIGHT,
	}));

	const longName = {
		E: "東",
		S: "南",
		W: "西",
		N: "北",
	};

	const infoText = `<span foreground="white"><b>Round:${
		longName[round as keyof typeof longName]
	} Seat:${longName[seat as keyof typeof longName]} Turn:${turn}</b></span>`;

	// Make the images smaller for the dora wall
	const indicatorImage = await sharp(`assets/ui/${indicator}.png`)
		.resize({ width: DORA_WIDTH })
		.toBuffer();
	const doraBack = await sharp(`assets/ui/xm.png`)
		.resize({ width: DORA_WIDTH })
		.toBuffer();

	const doraWall = [
		doraBack,
		doraBack,
		indicatorImage,
		doraBack,
		doraBack,
		doraBack,
		doraBack,
	];

	// Add the header and dora wall to the image inputs
	composite.push(
		{
			input: {
				text: {
					text: infoText,
					dpi: 200,
					rgba: true,
					font: "monospace",
				},
			},
			left: 20,
			top: 20,
		},
		...doraWall.map((image, index) => ({
			input: image,
			left: 480 + index * DORA_WIDTH,
			top: 7,
		}))
	);

	// Draw the image
	return await sharp({
		create: {
			width: TILE_WIDTH * 14 + TILE_GAP,
			height: TILE_HEIGHT + HEADER_HEIGHT,
			channels: 4,
			background: { r: 255, g: 255, b: 255, alpha: 0 },
		},
	})
		.composite(composite)
		.toFormat("png", { quality: 100 })
		.toBuffer();
};

/**
 * E.g. Transforms ["5p", "6p", "7p", "2s"] into "567p2s"
 * If 4+ in a row, adds a dash (like "1-5s")
 *
 * @param tiles array of tiles in standard notation
 * @returns String of tiles in standard notation
 */
const compressNotation = (tiles: string[]): string => {
	const map: Record<string, string> = { m: "", p: "", s: "", z: "" };
	tiles.forEach((tile) => (map[tile[1]] += tile[0]));

	return Object.entries(map)
		.filter(([, values]) => values)
		.map(([suit, values]) => {
			if (values.length < 4) {
				return values + suit;
			}

			// Sort the numbers and find consecutive sequences
			const nums = values
				.split("")
				.map(Number)
				.sort((a, b) => a - b);
			const result: string[] = [];
			let start = 0;

			for (let i = 1; i <= nums.length; i++) {
				// End of sequence or end of array
				if (i === nums.length || nums[i] !== nums[i - 1] + 1) {
					const sequenceLength = i - start;
					if (sequenceLength >= 4) {
						result.push(`${nums[start]}-${nums[i - 1]}`);
					} else {
						result.push(nums.slice(start, i).join(""));
					}
					start = i;
				}
			}

			return result.join("") + suit;
		})
		.join("");
};

const pct = (f: number) => `${(f * 100).toFixed(2)}%`;
const pad = (s: number | string, n: number) => s.toString().padEnd(n, " ");

export function formatAnalysisCompact(rows: WwydAnalysisResult[], limit = 10): string {
	rows.sort((a, b) => b.value - a.value);
	const data = [...rows].slice(0, limit);

	const head = "    Waits  Tiles              EV     Win%    Tenpai";
	const lines = [head];

	for (const r of data) {
		const tile = `${r.tile}${r.back ? "*" : " "}`;
		const waits = pad(`${r.wait_count}(${r.wait_unique})`, 6);
		const tiles = pad(compressNotation(r.wait_types).slice(0, 18), 18);
		const ev = pad(r.value.toFixed(0), 6);
		const win = pad(pct(r.winning), 7);
		const ten = pad(pct(r.tenpai), 7);

		lines.push(tile + " " + waits + " " + tiles + " " + ev + " " + win + " " + ten);
	}

	// Wrap in code blocks (Discord field limit 1024 chars)
	const blocks: string[] = [];
	let cur = "||```text\n";
	for (const ln of lines) {
		if (cur.length + ln.length + 4 > 1024) {
			cur += "```";
			blocks.push(cur);
			cur = "```text\n";
		}
		cur += ln + "\n";
	}
	cur += "```||";
	blocks.push(cur);
	return blocks.join("\n");
}

/**
 * Prepare the embed for display. Image, title, fields, attachments etc.
 * Does not actually send the message out (channel/guild-agnostic).
 *
 * @param embed - Discord.js embed object to populate with WWYD data
 * @param analysisEmbed - Discord.js embed object to populate with analysis data
 * @param mode - Display mode: 0 = today, 1 = yesterday, 2 = random
 * @returns Array of file objects to be sent alongside the embeds
 */
export const prepareWwydEmbed = async (
	embed: EmbedBuilder,
	analysisEmbed: EmbedBuilder,
	mode = 0 // 0 = today, 1 = yesterday, 2 = random
): Promise<{ attachment: string; name: string }[]> => {
	// Used as the output directory for generated images.
	if (!existsSync("tmp")) {
		mkdirSync("tmp");
	}

	const wwyds: Wwyd[] = JSON.parse(readFileSync("assets/wwyd-new.json", "utf-8"));
	const { wwyd, date } = (() => {
		switch (mode) {
			case 0: // today
				return getWwyd(wwyds, dayjs());
			case 1: // yesterday
				// Subtract relative to WWYD day: getWwyd will re-adjust after subtraction
				return getWwyd(wwyds, toWwydDate(dayjs()).subtract(1, "day"));
			default:
				return {
					wwyd: wwyds[Math.floor(Math.random() * wwyds.length)],
					date: dayjs(),
				};
		}
	})();

	embed.setTitle(`Answer: \\| ${spoiler(wwyd.answer)} \\|`);

	const parseCommentElements = (str: string[] | string) => {
		if (!Array.isArray(str)) {
			return str;
		}
		if (str[0] === "<b>") {
			return bold(str[1]);
		}
		return compressNotation(str);
	};

	embed.addFields({
		name: "Explanation",
		value: spoiler(wwyd.comment.map(parseCommentElements).join("")),
	});

	embed.setDescription(`WWYD: ${mode < 2 ? date.format("YYYY-MM-DD") : "Random"}`);
	const outFileName = `${wwyd.hand}.png`;
	const outFilePath = `tmp/${outFileName}`;

	await sharp(await generateWwydComposite(wwyd)).toFile(outFilePath);
	embed.setImage(`attachment://${outFileName}`);

	try {
		const analysis = await analyzeWWYDSituation(wwyd);
		analysisEmbed.addFields({
			name: "Pystyle Analysis",
			value: formatAnalysisCompact(analysis),
		});
	} catch (error) {
		console.error("Error analyzing WWYD situation:", error);
		analysisEmbed.setTitle("Error analyzing WWYD situation");
		analysisEmbed.setDescription(String(error));
	}

	analysisEmbed.setFooter({
		text: "Note: Pystyle is purely a self-draw simulator: It does not account for defense, calls, riichi, and other variables.",
	});
	return [
		{
			attachment: outFilePath,
			name: outFileName,
		},
	];
};

/**
 * Build daily WWYD without revealing answer/analysis, with buttons for each tile guess.
 */
export const buildDailyWwydMessage = async (embed: EmbedBuilder) => {
	if (!existsSync("tmp")) mkdirSync("tmp");

	const wwyds: Wwyd[] = JSON.parse(readFileSync("assets/wwyd-new.json", "utf-8"));
	const { wwyd, date } = getWwyd(wwyds, dayjs());

	// Title without answer
	embed.setTitle("What Would You Discard?");
	embed.setDescription(`WWYD: ${date.format("YYYY-MM-DD")}`);

	// Image
	const outFileName = `${wwyd.hand}.png`;
	const outFilePath = `tmp/${outFileName}`;
	await sharp(await generateWwydComposite(wwyd)).toFile(outFilePath);
	embed.setImage(`attachment://${outFileName}`);

	// Build buttons for each unique tile in [...hand, draw]
	const uniqueTiles = Array.from(new Set([...wwyd.hand, wwyd.draw]));
	const dateStr = date.format("YYYY-MM-DD");

	const suitToStyle = (tile: string): ButtonStyle => {
		if (tile.endsWith("m")) return ButtonStyle.Danger;
		if (tile.endsWith("p")) return ButtonStyle.Secondary;
		if (tile.endsWith("s")) return ButtonStyle.Success;
		if (tile.endsWith("z")) return ButtonStyle.Primary;
		return ButtonStyle.Primary; // fallback
	};
	const buttons = uniqueTiles.map((t) =>
		new ButtonBuilder()
			.setCustomId(`wwyd:guess:${dateStr}:${t}`)
			.setLabel(t)
			.setStyle(suitToStyle(t))
	);

	buttons.push(
		new ButtonBuilder()
			.setCustomId(`wwyd:guess:${dateStr}:pass`)
			.setLabel("Pass")
			.setStyle(ButtonStyle.Secondary)
	);

	// Discord allows up to 5 buttons per row; tile count is <= 14, so split into rows
	const rows: ActionRowBuilder<ButtonBuilder>[] = [];
	for (let i = 0; i < buttons.length; i += 5) {
		rows.push(
			new ActionRowBuilder<ButtonBuilder>({ components: buttons.slice(i, i + 5) })
		);
	}

	return {
		embeds: [embed],
		files: [{ attachment: outFilePath, name: outFileName }],
		components: rows,
	};
};
