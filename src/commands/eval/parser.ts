import { AST } from "./ast";
import { LL_1 } from "./ll1";
import { Tokenizer } from "./tokenizer";


export function parseArithmetic(raw : string) : AST | null {
    let tk = new Tokenizer(raw);
    tk.debugPrint();
    let parser = new LL_1(tk);
    return parser.construct();
}