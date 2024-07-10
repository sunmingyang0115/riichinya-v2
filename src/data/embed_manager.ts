import { EmbedBuilder, Client } from "discord.js";
import { CommandBuilder } from "./cmd_manager";

export class EmbedManager extends EmbedBuilder {
    constructor (commandname : string, profile : Client) {
        super()
        this
        .setTitle(commandname)
        .setColor(0xFFC0CB)
        .setFooter({ 
            text: profile.user!.displayName, 
            iconURL: profile.user!.avatarURL()!,
        });
        
    }

    public addContent(content : string) : this {
        return this.setDescription(content);
    }

    public addObjectArrayToField(ob : object[]) : this {
        if (ob.length == 0) return this;

        let labels = Object.keys(ob[0]);
        let cols = Object.values(ob[0]).length;

        for (var col = 0; col < cols; col++) {
            let label = labels[col];
            let out : any[] = [];
            for (var row = 0; row < ob.length; row++) {
                out.push(this.format(Object.values(ob[row])[col], label));
            }
            this.addFields({name: label, value : out.join('\n'), inline: true});
        }
        return this;
    }

    private format(t : object, label : string) : any {
        if (label.startsWith("player_id")) {
            console.log(`<@${t}>`)  
            return `<@${t}>`;
        } else if (label.startsWith("date")) {
            let date = new Date(Number(`${t}`));
            let year = date.getFullYear();
            let month = String(date.getMonth() + 1).padStart(2, '0');
            let day = String(date.getDate()).padStart(2, '0');
            let hours = String(date.getHours()).padStart(2, '0');
            let minutes = String(date.getMinutes()).padStart(2, '0');
            let seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        }
        return t;
    } 
}