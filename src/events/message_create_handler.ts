import { CommandBuilder } from "../data/cmd_manager";
import { EventBuilder } from "../data/event_manager";
import { Events, Message } from "discord.js"

export class MessageCreateHandler implements EventBuilder {
    private messageMap : Map<string, CommandBuilder>;
    constructor (commands : CommandBuilder[]) {
        this.messageMap = new Map<string, CommandBuilder>;
        commands.forEach((command : CommandBuilder) => {
            this.messageMap.set(command.getCommandName(), command);
        });
    }
    getEventType(): string {
        return Events.MessageCreate;
    }
    async getEventCallFunction(m : Message) {
        if (m.author.bot) return;
        let frag = m.content.split(/[ ,]+/);

        if (frag[0] == "ron" && this.messageMap.has(frag[1])) {
            await this.messageMap.get(frag[1])!.runCommand(m, frag.slice(2));
        }
        //  else if (frag[0] == "ron-help" && (frag.length == 1 || frag[1] == "readme")) {
        //     let builder : string[] = [
        //         "\`\`\`ini",
        //         "#!/nya/docs/readme",
        //         "",
        //         "Greetings fellow riichier! This is a bot made for UW Mahjong club. [insert more dialogue later]",
        //         "",
        //         "This block message will be the format for all help descriptions for this bot. It can be called by using \`ron-help [any command]\`.",
        //         "",
        //         "To see how a particular command is used, look under the [Usage] tab. Here it outlines it's argument name, it's type, it's brief descrption, and subarguments. The type refers to what type of text is given to the argument position. Some simple types are NUMBER, STRING, and VOID - these types expect a number, string, and no argument respectively. The details of the subargument is visualized by an indentation under the parent argument. Subarguments can have subargument of their own as well. Some subarguments uses '|', which is used to denote options for subarguments and will document different behaviour based on what is given in the subargument.",
        //         "",
        //         "That is about it for documentation. If anything is not clear feel free to direct message <@372123318167273502>, the bot owner.",
        //         "\`\`\`"
        //     ]
        //     m.reply(builder.join("\n"));
        // }
         else if (frag[0] == "ron-help" && this.messageMap.has(frag[1])) {
            m.reply(this.messageMap.get(frag[1])!.getDocumentation());
        }
    }
}
