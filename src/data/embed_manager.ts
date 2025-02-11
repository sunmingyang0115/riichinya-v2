import { EmbedBuilder, Client } from "discord.js";
import { CommandBuilder } from "./cmd_manager";
import { MJS_ERROR_TYPE } from "../cmds/mjs/common";

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
            let out : unknown[] = [];
            for (var row = 0; row < ob.length; row++) {
                out.push(this.format(Object.values(ob[row])[col], label));
            }
            this.addFields({name: label, value : out.join('\n'), inline: true});
        }
        return this;
    }

    // worst code in the entire codebase
    private format(t : object, label : string) : any {
        if (label.startsWith("id_player")) {
            // console.log(`<@${t}>`)  
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
        } else if (label.startsWith("score")) {
            return Number(`${t}`).toFixed(1);
        }
        return t;
    }
    
    static createErrorEmbed(error : any, profile : Client) : EmbedBuilder {
        let eb = new EmbedManager(":(", profile);
        console.error(error);
        if (error instanceof Error) {
            eb.addFields({name : error.name, value : error.message});
        } else if (error.hasOwnProperty("mjsErrorType")) {
            let value;
            switch (error.mjsErrorType) {
                case MJS_ERROR_TYPE.MULTIPLE_MATCHING_USERS:
                    value = "Multiple users match the provided username." 
                    break;
                
                case MJS_ERROR_TYPE.NO_MATCHING_USERS:
                    value = "No users match the provided username."
                    break;
                
                case MJS_ERROR_TYPE.NICK_AMAE_MISMATCH:
                    value = "The provided username and amae ID do not match."
                    break;
            
                default:
                    break;
            }
            eb.addFields({name: MJS_ERROR_TYPE[error.mjsErrorType], value: value});
        } else {
            eb.setDescription("Cannot generate error message");
        }
        return eb;
    }
}