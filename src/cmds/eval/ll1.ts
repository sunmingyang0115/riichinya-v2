import { Tokenizer } from "./tokenizer";

export type maybeNumber = number | null

// not actually LL(1) parser due to right associativity with exponents
export class LL_1 {
    tk : Tokenizer;
    constructor(tk : Tokenizer) {
        this.tk = tk;
    }
    public construct() : maybeNumber {
        let res = this.rule_E();
        if (!this.tk.isEmpty()) return null;
        return res;
    }
    // does the reductions and such
    private rule_E() : maybeNumber {
        let a = this.rule_T();
        let b = this.rule_Ed(a);    // provide E' with 'context'
        return b;
    }
    private rule_Ed(a : maybeNumber) : maybeNumber {
        if (this.tk.peakToken() == '+') {
            this.tk.nextToken();
            let b = this.rule_T();
            return this.rule_Ed(this.map_binary(this.add, a, b));
        } else if (this.tk.peakToken() == '-') {
            this.tk.nextToken();
            let b = this.rule_T();
            return this.rule_Ed(this.map_binary(this.sub, a, b));
        }
        return a;
    }
    private rule_T() : maybeNumber {
        let a = this.rule_X();
        let b = this.rule_Td(a);
        return b;
    }
    private rule_Td(a : maybeNumber) : maybeNumber {
        if (this.tk.peakToken() == '*') {
            this.tk.nextToken();
            let b = this.rule_X();
            return this.rule_Td(this.map_binary(this.mul, a, b));
        }  else if (this.tk.peakToken() == '/') {
            this.tk.nextToken();
            let b = this.rule_X();
            return this.rule_Td(this.map_binary(this.div, a, b));
        } else if (this.tk.peakToken() == '(') {
            let b = this.rule_X();
            return this.rule_Td(this.map_binary(this.mul, a, b));
        }
        return a;
    }
    private rule_X() : maybeNumber {
        // pow is left associative, so we need a continuation stack
        let mt: [string, maybeNumber][] = [['null', this.rule_F()]];
        let cont = this.rule_Xd(mt);

        let tmp = cont.pop()!;
        let op : string = tmp[0];
        let head : maybeNumber = tmp[1];
        
        cont.reverse().forEach((ast : [string, maybeNumber]) => {
            if (op == '^') {
                head = this.map_binary(Math.pow, ast[1], head);
                op = ast[0];
            }
        })
        return head; 
    }
    private rule_Xd(ctx : [string, maybeNumber][]) : [string, maybeNumber][] {
   
        if (this.tk.peakToken() == '^') {
            this.tk.nextToken();
            let b = this.rule_F();
            ctx.push(['^', b]);
            return this.rule_Xd(ctx);
        } 
        return ctx;
    }
    

    private rule_F() : maybeNumber {
        if (this.tk.peakToken() == 'log') {
            this.tk.nextToken();
            let b = this.rule_F();
            return this.map_uniary(Math.log, b);
        } else if (this.tk.peakToken() == 'sin') {
            this.tk.nextToken();
            let b = this.rule_F();
            return this.map_uniary(Math.sin, b);
        } else if (this.tk.peakToken() == 'cos') {
            this.tk.nextToken();
            let b = this.rule_F();
            return this.map_uniary(Math.cos, b);
        } else if (this.tk.peakToken() == 'tan') {
            this.tk.nextToken();
            let b = this.rule_F();
            return this.map_uniary(Math.tan, b);
        } else if (this.tk.peakToken() == 'pi') {
            this.tk.nextToken();
            return Math.PI;
        } else if (this.tk.peakToken() == 'e') {
            this.tk.nextToken();
            return Math.E;
        }
        else if (this.tk.peakToken() == '(') {
            this.tk.nextToken();
            let res = this.rule_E();
            if (this.tk.peakToken() == ')') {
                this.tk.nextToken();
                return res;
            }
            return null;    
        }
        else if (this.tk.peakToken() == '-') {
            this.tk.nextToken();
            let b = this.rule_X();
            return this.map_binary(this.sub, 0, b);
        }
        if (this.tk.peakToken() == null) return null;
        let p = Number(this.tk.peakToken());
        if (!Number.isNaN(p)) {
            this.tk.nextToken();
            return p;
        }
        return null;
    }

    private add(a : number, b : number) {
        return a + b;
    }
    private sub(a : number, b : number) {
        return a - b;
    }
    private mul(a : number, b : number) {
        return a * b;
    }
    private div(a : number, b : number) {
        return a / b;
    }


    private map_binary(fn : (a: number, b: number) => number, a : maybeNumber, b : maybeNumber) : maybeNumber {
        if (a == null || b == null) return null;
        return fn(a, b);
    }

    private map_uniary(fn : (a: number) => number, a : maybeNumber) : maybeNumber {
        return a==null?null:fn(a);
    }

    
}