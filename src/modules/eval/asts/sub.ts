import { AST } from "../ast";

export class Sub implements AST {
    private a : AST;
    private b : AST;
    constructor(a : AST, b : AST) {
        this.a = a;
        this.b = b;
    }
    toString(): string {
        return "(Sub " + this.a.toString() + " " + this.b.toString() + ")";
    }
    interp(): number {
        return this.a.interp() - this.b.interp();
    }
}