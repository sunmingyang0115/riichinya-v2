import { AST } from "../ast";

export class Lit implements AST {
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
