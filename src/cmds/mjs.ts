import { EmbedBuilder, Message } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder, ExpectedType } from "../data/doc_manager";
import { EmbedManager } from "../data/embed_manager";
import { linkHandler } from "./mjs/cmd_link";
import { statsHandler } from "./mjs/cmd_stats";
import { unlinkHandler } from "./mjs/cmd_unlink";
import { leaderboardHandler } from "./mjs/cmd_leaderboard";
import { existsSync, mkdirSync } from "fs";

export class MjsCommand implements CommandBuilder {
  getDocumentation(): string {
    return new DocBuilder()
      .addSingleSubCom("ron", ExpectedType.LITERAL, "")
      .addSingleSubCom("mjs", ExpectedType.LITERAL, "")
      .beginMultiSubCom("link")
      .insertMultiSubCom(
        ExpectedType.LITERAL,
        "ron mjs link - Provide no additional arguments to get currently linked MJS user"
      )
      .addSingleSubCom(
        "username",
        ExpectedType.TEXT,
        "ron mjs link <username> - Link provided Mahjong Soul username to your account."
      )
      .back()
      .back()
      .beginMultiSubCom("stats")
      .insertMultiSubCom(
        ExpectedType.LITERAL,
        "ron mjs stats - Get your Mahjong Soul stats."
      )
      .addSingleSubCom(
        "user_nick",
        ExpectedType.TEXT,
        "ron mjs stats <username> - Get Mahjong Soul stats for given user."
      )
      .back()
      .back()
      .beginMultiSubCom("lb|leaderboard")
      .insertMultiSubCom(
        ExpectedType.LITERAL,
        "ron mjs lb - Gets the server leaderboard for Mahjong Soul Ranks."
      )
      .addSingleSubCom(
        "--sort-by=",
        ExpectedType.LITERAL,
        "ron mjs lb --sort-by=<sortKey> - Sort the leaderboard by 'points' or 'delta'"
      )
      .build();
  }
  getCommandName(): string {
    return "mjs";
  }
  getCooldown(): number {
    return 0;
  }

  async runCommand(event: Message<boolean>, args: string[]) {
    const eb = new EmbedManager(this.getCommandName(), event.client);

    // All the handlers defined here are responsible for adding the embeds/formatting, etc.
    const subcommands: {
      [command: string]: {
        handler: (
          event: Message<boolean>,
          args: string[],
          embed: EmbedBuilder
        ) => Promise<string | undefined>;
      };
    } = {
      link: {
        handler: linkHandler,
      },
      unlink: {
        handler: unlinkHandler,
      },
      stats: {
        handler: statsHandler,
      },
      lb: {
        handler: leaderboardHandler,
      },
      leaderboard: {
        handler: leaderboardHandler,
      },
    };

    // Used as the output directory for generated images.
    // Should prooobably have a cron job running that periodically deletes this folder
    if (!existsSync("tmp")) {
      mkdirSync("tmp");
    }
    
    const isValidSubcommand = Object.keys(subcommands).includes(args[0]);

    if (isValidSubcommand) {
      // These handlers should return "" if no error occurred.
      // If something was returned, return the error to the user.
      const errorString = await subcommands[args[0]].handler(
        event,
        args.slice(1),
        eb
      );
      if (errorString) {
        eb.addContent(errorString);
        event.reply({ embeds: [eb] });
      }
    } else {
      eb.addContent(
        `Available commands are ${Object.keys(subcommands)
          .map((command) => `\`${command}\``)
          .join(", ")}.\nFor example, try \`ron mjs stats <username>\` to get Majsoul stats.`
      );
      event.reply({ embeds: [eb] });
    }
  }
}
