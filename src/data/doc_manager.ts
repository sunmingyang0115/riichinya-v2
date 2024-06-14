
export enum ExpectedType {
    LITERAL,
    EMPTY,
    TEXT,
    INTEGER,
    DECIMAL
};

export class DocBuilder {
    depth : string[];
    strlst : string[];
    onExp : boolean;
    onArg : boolean;
    constructor() {
        this.depth = [];
        this.strlst = [
            "```ini",
            `#!/nya/docs`,
        ];
        this.onExp = false;
        this.onArg = false;
    }
    
    private _argHeaderCheck() {
        if (!this.onArg) {
            this.onArg = true;
            this.strlst.push("");
            this.strlst.push("[Arguments]");
        }
    }
    private _indent() {
        return this.depth.join("");
    }
    beginMultiSubCom(arg_name : string) {
        this._argHeaderCheck();
        let str = `${this._indent()}`;
        this.depth.push(str.replace(/./g,' '));
        this.strlst.push(`${str}${arg_name} =`);
        return this;
    }
    insertMultiSubCom(arg_type : ExpectedType, arg_desc : string) : DocBuilder  {
        this.strlst.push(`${this._indent()}| = ${ExpectedType[arg_type]} ;-> ${arg_desc}`);
        return this;
    }
    addSingleSubCom(arg_name : string, arg_type : ExpectedType, arg_desc : string) : DocBuilder {
        this._argHeaderCheck();
        this.strlst.push(`${this._indent()}${arg_name} = ${ExpectedType[arg_type]} ;-> ${arg_desc}`);
        this.depth.push(" ");
        return this;
    }
    back() : DocBuilder {
        this.depth.pop();
        return this;
    }
    addExampleDoc(command : string, output: string, desc : string) : DocBuilder{
        if (!this.onExp) {
            this.onExp = true;
            this.strlst.push("");
            this.strlst.push("[Example]");
        }
        this.strlst.push(`'${command}' = '${output}' ;-> ${desc}`);
        return this;
    }
    build() {
        this.strlst.push("\n#<eof-object>```");
        return this.strlst.join("\n");
    }
}



