import sqlite3 from "sqlite3";
sqlite3.verbose()

const db = new sqlite3.Database('rdb.sql');
const date = new Date();
export class RiichiDatabase {

    static init() {
        db.serialize(() => {
            db.run("CREATE TABLE IF NOT EXISTS gamedata (id INTEGER, date INTEGER, p1 INTEGER, p2 INTEGER, p3 INTEGER, p4 INTEGER, s1 INTEGER, s2 INTEGER, s3 INTEGER, s4 INTEGER)");

            // db.run("CREATE TABLE lorem (info TEXT)");
            // const stmt = db.prepare("INSERT INTO lorem VALUES (?)");
            // for (let i = 0; i < 10; i++) {
            //    stmt.run("Ipsum " + i);
            // }
            // stmt.finalize();

            // db.each("SELECT rowid AS test, info FROM lorem", (err, row : {test: number, info: string}) => {
            //     // console.log(row) 
            //     console.log(row.test + " " + row.info);
            // });
        })
    }

    static insertData(id : string, data : {id : string, score : number}[]) {
        let stmt : string[] = [];
        // stmt.push("INSERT INTO gamedata VALUES (id, date, p1, s1, p2, s2, p3, s3, p4, s4)");
        // stmt.push(id);
        stmt.push(id);
        stmt.push(date.getTime().toString());
        for (let pair of data) {
            stmt.push(pair.id.toString());
            stmt.push(pair.score.toString());
        }
        console.log(`INSERT INTO gamedata (id, date, p1, s1, p2, s2, p3, s3, p4, s4) VALUES (${stmt.join(", ")})`);
        db.run(`INSERT INTO gamedata (id, date, p1, s1, p2, s2, p3, s3, p4, s4) VALUES (${stmt.join(", ")})`);

    }

    getLBAveragePlacement() : {id: number; value: number}[] {
        return [{id:1,value:1}]
    }

    
    /**
     * EXTERNAL
     * global lb
     *  -> by avg placement
     *  -> by avg/acc adjscore
     *  -> by acc wins
     *  -> by date
     *  -> by times played
     * 
     * user lb
     *  -> by avg/acc adjscore
     *  -> by acc wins
     *  -> by avg placement
     *  -> times played
     */

    /**
     * INTERNAL
     * 
     * GO:
     * gameid, date,
     * playerid (p1,p2,p3,p4),
     * score# (s1,s2,s3,s4)
     * 
     * PO:
     * playerid, date, score#, ranking
     */

    static insert() {
        let stmt = db.prepare("INSERT INTO a VALUES (?)");
    }
}