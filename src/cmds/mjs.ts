import { EmbedBuilder, Message } from "discord.js";
import { CommandBuilder } from "../data/cmd_manager";
import { DocBuilder, ExpectedType } from "../data/doc_manager";
import { EmbedManager } from "../data/embed_manager";
import { linkHandler } from "./mjs/cmd_link";
import { statsHandler } from "./mjs/cmd_stats";
import { unlinkHandler } from "./mjs/cmd_unlink";

export class MjsCommand implements CommandBuilder {
  getDocumentation(): string {
    return new DocBuilder()
      .addSingleSubCom("ron", ExpectedType.LITERAL, "")
      .addSingleSubCom("mjs", ExpectedType.LITERAL, "")
      .addSingleSubCom(
        "link",
        ExpectedType.LITERAL,
        "Provide no additional arguments to get currently linked MJS user."
      )
      .addSingleSubCom(
        "user_nick",
        ExpectedType.TEXT,
        "Link provided Mahjong Soul username to your account."
      )
      .back()
      .back()
      .addSingleSubCom(
        "stats",
        ExpectedType.LITERAL,
        "Get your Mahjong Soul stats."
      )
      .addSingleSubCom(
        "user_nick",
        ExpectedType.TEXT,
        "Get Mahjong Soul stats for given username."
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
    };
    const isValidSubcommand = Object.keys(subcommands).includes(args[0]);

    const content = isValidSubcommand
      ? await subcommands[args[0]].handler(event, args.slice(1), eb)
      : `Command not found. Available commands are ${Object.keys(subcommands)
          .map((command) => `\`${command}\``)
          .join(", ")}.`;

    content && eb.addContent(content);
    event.reply({ embeds: [eb] });
  }
}
