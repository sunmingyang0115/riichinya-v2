import { Add } from "./asts/add";
import { Div } from "./asts/div";
import { Lit } from "./asts/lit";
import { Mul } from "./asts/mul";
import { Sub } from "./asts/sub";


export interface AST {
    toString() : string;
    interp() : number;
}

