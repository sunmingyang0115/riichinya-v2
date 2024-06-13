


export class Documentation {
    subargs: Documentation[];
    name : string;
    type : string;
    desc : string;
    constructor(name : string, type : string, desc : string, ...subargs : Documentation[]) {
        this.name = name;
        this.subargs = subargs;
        this.type = type;
        this.desc = desc;
    }
    build() : string {
        let strlst : string[] = [];
        return this.build_helper(strlst, "").join("\n");
    }
    private build_helper(strlst : string[], depth : string) : string[] {
        strlst.push(`${depth}${this.name} = ${this.type};- ${this.desc}`);
        if (this.subargs.length > 1) {
            this.subargs.map((db : Documentation) => {
                db.build_helper(strlst, depth+"| ");
            })
        } else {
            this.subargs.map((db : Documentation) => {
                db.build_helper(strlst, depth+" ");
            })
        }
        
        return strlst;
    }
}
