
const sy = ['(',')','*','/','-','+','^']

export class Tokenizer {
    tokens : string[];
    constructor (raw : string) {
        sy.forEach((c : string) => {
            raw = raw.split(c).join(' '+c+' ');
        });
        this.tokens = raw.trim().split(/[ ]+/);
    }
    public nextToken() : string | null {
        if (this.isEmpty()) return null;
        return this.tokens.shift()!;
    }
    public isEmpty() : boolean {
        return this.tokens.length == 0;
    }
    public peakToken() : string | null {
        if (this.isEmpty()) return null;
        return this.tokens[0];
    }
    public debugPrint() {
        console.log(this.tokens);
    }
}