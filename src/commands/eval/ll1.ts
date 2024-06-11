import { AST } from "./ast";
import { Add } from "./asts/add";
import { Div } from "./asts/div";
import { Lit } from "./asts/lit";
import { Mul } from "./asts/mul";
import { Pow } from "./asts/pow";
import { Sub } from "./asts/sub";
import { Tokenizer } from "./tokenizer";

// not actually LL(1) parser due to right associativity with exponents
export class LL_1 {
    tk : Tokenizer;
    constructor(tk : Tokenizer) {
        this.tk = tk;
    }
    public construct() : AST | null {
        let res = this.rule_E();
        if (!this.tk.isEmpty()) return null;
        return res;
    }
    // does the reductions and such
    private rule_E() : AST | null {
        let a = this.rule_T();
        let b = this.rule_Ed(a);    // provide E' with 'context'
        return b;
    }
    private rule_Ed(a : AST | null) : AST | null {
        
        if (this.tk.peakToken() == '+') {
            this.tk.nextToken();
            let b = this.rule_T();
            return this.rule_Ed(this.new_add_safe(a, b));
        } else if (this.tk.peakToken() == '-') {
            this.tk.nextToken();
            let b = this.rule_T();
            return this.rule_Ed(this.new_sub_safe(a, b));
        }
        return a;
    }
    private rule_T() : AST | null {
        let a = this.rule_X();
        let b = this.rule_Td(a);
        return b;
    }
    private rule_Td(a : AST | null) : AST | null {
        if (this.tk.peakToken() == '*') {
            this.tk.nextToken();
            let b = this.rule_X();
            return this.rule_Td(this.new_mul_safe(a, b));
        }  else if (this.tk.peakToken() == '/') {
            this.tk.nextToken();
            let b = this.rule_X();
            return this.rule_Td(this.new_div_safe(a, b));
        } else if (this.tk.peakToken() == '(') {
            let b = this.rule_X();
            return this.rule_Td(this.new_mul_safe(a, b));
        }
        return a;
    }
    private rule_X() : AST | null {
        // pow is left associative, so we need a continuation stack
        let mt: [string, AST | null][] = [['null', this.rule_F()]];
        let cont = this.rule_Xd(mt);

        let tmp = cont.pop()!;
        let op : string = tmp[0];
        let head : AST | null = tmp[1];
        
        cont.reverse().forEach((ast : [string, AST | null]) => {
            if (op == '^') {
                head = this.new_pow_safe(ast[1], head);
                op = ast[0];
            }
        })
        return head; 
    }
    private rule_Xd(ctx : [string, AST | null][]) : [string, AST | null][] {
        if (this.tk.peakToken() == '^') {
            this.tk.nextToken();
            let b = this.rule_F();
            ctx.push(['^', b]);
            return this.rule_Xd(ctx);
        } 
        return ctx;
    }

    private rule_F() : AST | null {
        if (this.tk.peakToken() == '(') {
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
            return this.new_sub_safe(this.new_lit_safe(0), b);
        }
        if (this.tk.peakToken() == null) return null;
        let p = Number(this.tk.peakToken());
        if (!Number.isNaN(p)) {
            this.tk.nextToken();
            return this.new_lit_safe(p);
        }
        return null;
    }


    private new_add_safe(a : AST | null, b : AST | null) : AST | null {
        if (a == null || b == null)  return null;
        return new Add(a, b);
    } 
    
    private new_sub_safe(a : AST | null, b : AST | null) : AST | null {
        if (a == null || b == null) return null;
        return new Sub(a, b)
    } 
    
    private new_mul_safe(a : AST | null, b : AST | null) : AST | null {
        if (a == null || b == null) return null;
        return new Mul(a, b)
    } 
    
    private new_div_safe(a : AST | null, b : AST | null) : AST | null {
        if (a == null || b == null) return null;
        return new Div(a, b)
    } 
    
    private new_lit_safe(a : number) {
        return new Lit(a);
    }

    private new_pow_safe(a : AST | null, b : AST | null) : AST | null {
        if (a == null || b == null) return null;
        return new Pow(a, b)
    } 
}