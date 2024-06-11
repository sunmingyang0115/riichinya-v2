import { AST } from "./ast";
import { Add } from "./asts/add";
import { Div } from "./asts/div";
import { Lit } from "./asts/lit";
import { Mul } from "./asts/mul";
import { Sub } from "./asts/sub";
import { Tokenizer } from "./tokenizer";

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
        let a = this.rule_F();
        let b = this.rule_Td(a);
        return b;
    }
    private rule_Td(a : AST | null) : AST | null {
        if (this.tk.peakToken() == '*') {
            this.tk.nextToken();
            let b = this.rule_F();
            return this.rule_Td(this.new_mul_safe(a, b));
        }  else if (this.tk.peakToken() == '/') {
            this.tk.nextToken();
            let b = this.rule_F();
            return this.rule_Td(this.new_div_safe(a, b));
        }
        return a;
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
            let b = this.rule_T();
            return this.new_sub_safe(this.new_lit_safe(0), b);
        }
        else if (!Number.isNaN(Number(this.tk.peakToken()))) {
            return this.new_lit_safe(Number(this.tk.nextToken()));
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
    
    private new_lit_safe(a : number | null) {
        if (a == null) return null;
        return new Lit(a);
    }
}