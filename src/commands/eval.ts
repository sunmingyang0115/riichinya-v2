import { Message } from "discord.js";
import { CommandBuilder } from "../data/command_manager";
import { stringify } from "querystring";
// enum TokenType {OP, CP, MUL, ADD, LIT, ERR}

// class Tokenizer {
//     private tokens : string[];
//     private i : number;
//     constructor (tokens : string[]) {
//         this.tokens = tokens;
//         this.i = 0;
//     }
//     public getCurrentToken() : string | number | null {
//         if (this.tokens.length == this.i) return null;
//         let res = Number(this.tokens[this.i]);
//         if (Number.isNaN(res)) return this.tokens[this.i];
//         return res;
//     }
//     public pop() {
//         this.i++;
//     }
//     public getCurrentTokenType() : TokenType {
//         let t = this.getCurrentTokenType();
//         if (typeof t === "number") {
//             return TokenType.LIT;
//         } else if (t === "*") {
//             return TokenType.MUL;
//         } else if (t === "+") {
//             return TokenType.ADD;
//         } else if (t === "(") {
//             return TokenType.OP;
//         } else if (t === ")") {
//             return TokenType.CP;
//         }
//         return TokenType.ERR;
//     }
// }
interface AST {
    toString() : string;
    interp() : number;
}
class Add implements AST{
    private a : AST;
    private b : AST;
    constructor(a : AST, b : AST) {
        this.a = a;
        this.b = b;
    }
    toString(): string {
        return "(Add " + this.a.toString() + " " + this.b.toString() + ")";
    }
    interp(): number {
        return this.a.interp() + this.b.interp();
    }
}
class Mul implements AST{
    private a : AST;
    private b : AST;
    constructor(a : AST, b : AST) {
        this.a = a;
        this.b = b;
    }
    toString(): string {
        return "(Mul " + this.a.toString() + " " + this.b.toString() + ")";
    }
    interp(): number {
        return this.a.interp() * this.b.interp();
    }
}
class Lit implements AST {
    private n : number;
    constructor(n : number) {
        this.n = n;
    }
    toString(): string {
        return this.n.toString();
    }
    interp(): number {
        return this.n;
    }
}

class Parser {
    private cur : string;
    private logger : string[]
    private i : number;
    constructor(str : string) {
        this.cur = str;
        this.logger = [];
        this.i = 0;
    }
    public parse() : boolean {
        return this.rule_E() && this.cur.length == this.i;
    }
    public getLogger() : string {
        return this.logger.join('\n');
    }
    private getCur() : string {
        return this.cur.charAt(this.i);
    }
    private shift() {
        this.i++;
    }
    private log(rule : string) {
        this.logger.push(rule + "\n\t\t\t\t" + this.cur.substring(this.i));
    }
    private rule_E() : boolean {
        this.log('E -> T E\'');
        // console.log("%-16s E -> T E'\n", this.getCur());
        if (this.rule_T()) {
            if (this.rule_Ed()) {
                return true;
            }return false;
        }return false;
    }
    private rule_Ed() : boolean {
        if (this.getCur() == '+') {
            this.log('E\' -> + T E\'');
            // console.log("%-16s E' -> + T E'\n", this.getCur());
            this.shift();
            if (this.rule_T()) {
                if (this.rule_Ed()) return true;
                return false;
            }return false;
        }
        this.log('E\' -> $');
        // console.log("%-16s E' -> $\n", this.getCur());
        return true;
    }
    private rule_T() : boolean {
        this.log('T -> F T\'');
        // console.log("%-16s T -> F T'\n", this.getCur());
        if (this.rule_F()) { // Call non-terminal F
            if (this.rule_Td()) // Call non-terminal T'
                return true;
            return false
        } 
        return false;
    }
    private rule_Td() : boolean {
        if (this.getCur() == '*') {
            this.log('T\' -> * F T\'');
            // console.log("%-16s T' -> * F T'\n", this.getCur());
            this.shift();
            if (this.rule_F()) { // Call non-terminal F
                if (this.rule_Td()) // Call non-terminal T'
                    return true;
                return false;
            } 
            return false;
        } 
        this.log('T\' -> $');
        // console.log("%-16s T' -> $\n", this.getCur());
        return true;
    }
    private rule_F() {
        if (this.getCur() == '(') {
            this.log('F -> ( E )');
            // console.log("%-16s F -> ( E )\n", this.getCur());
            this.shift();
            if (this.rule_E()) { // Call non-terminal E
                if (this.getCur() == ')') {
                    this.shift();
                    return true;
                } 
                return false;
            } 
            return false;
        } 
        else if (this.getCur() == 'i') {
            this.log('F -> i');
            // console.log("%-16s F -> i\n", this.getCur());
            this.shift();
            return true;
        } 
        return false;
    }
}


export class EvalCommand implements CommandBuilder {
    getCommandName(): string {
        return "eval";
    }
    getCooldown(): number {
        return 0;
    }
    async runCommand(event: Message<boolean>, args: string[]) {
        // let ast = new Mul(new Add(new Lit(4), new Lit(65)), new Lit(2));
        let p = new Parser(args[0]);
        await event.reply("`" + args[0] + "` => " + p.parse() + "\n```" + p.getLogger() + "```");
    }
    
}