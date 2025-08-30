import { EmbedBuilder, Client } from "discord.js";
import { CommandBuilder } from "./cmd_manager";
import { MJS_ERROR_TYPE } from "../cmds/mjs/common";

export type Header = {
    /** key: the property name in the data object */
    k: string 
    /** label: the column header to display */
    l: string
    /** type: the formatting type (e.g., "mention", "date", "score") */
    t: string
};

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

    public addObjectArrayToMobile(headers: Header[], ob : Record<string, any>[]): this {
        if (ob.length == 0) return this;
        if (headers.length != Object.keys(ob[0]).length) {
            console.log(headers, ob[0])
            return this;
        }
        //Check if every header key exists in each ob
        for (const header of headers) {
            if (!ob.every(o => o.hasOwnProperty(header.k))) {
                console.error(`Header key ${header.k} does not exist in all objects.`);
                return this;
            }
        }

        let out = headers.map(h => h.l).join(' | ') + '\n';
        //add each row of data
        for (var row = 0; row < ob.length; row++) {
            let rowData = headers.map(h => this.format(ob[row][h.k], h.t)).join(' | ');
            out += rowData + '\n';
        }

        this.setDescription(out);
        return this;
    }

    public addObjectArrayToField(headers: Header[], ob : Record<string, any>[]) : this {
        if (ob.length == 0) return this;
        if (headers.length != Object.keys(ob[0]).length) {
            console.log(headers, ob[0])
            return this;
        }
        //Check if every header key exists in each ob
        for (const header of headers) {
            if (!ob.every(o => o.hasOwnProperty(header.k))) {
                console.error(`Header key ${header.k} does not exist in all objects.`);
                return this;
            }
        }

        for (var col = 0; col < headers.length; col++) {
            const header = headers[col];
            let out : unknown[] = [];
            for (var row = 0; row < ob.length; row++) {
                out.push(this.format(ob[row][header.k], header.t));
            }
            this.addFields({name: header.l, value : out.join('\n'), inline: true});
        }
        return this;
    }

    // worst code in the entire codebase
    private format(t : any, type: string) : any {
        if (type === "mention") {
            // console.log(`<@${t}>`)  
            return `<@${t}>`;
        } else if (type === "date") {
            const date = new Date(t);
            return date.toDateString();
        } else if (type === "score") {
            return Number(t).toFixed(1);
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
            eb.addFields({name: MJS_ERROR_TYPE[error.mjsErrorType], value: value!});
        } else {
            eb.setDescription("Cannot generate error message");
        }
        return eb;
    }
}