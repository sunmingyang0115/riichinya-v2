// Tests for the parseScoreFromRaw function, don't know where to put this

import { parseScoreFromRaw } from "../src/cmds/riichidb/score_parser";
import * as assert from "assert";

function testBasic() {
    const args = ["100001", "10000", "100002", "20000", "100003", "30000", "100004", "40000"];
    const result = parseScoreFromRaw(args);
    assert.deepStrictEqual(result.id, [ '100004', '100003', '100002', '100001' ]);
    assert.deepStrictEqual(result.scoreRaw, [40000, 30000, 20000, 10000]);
    assert.deepStrictEqual(result.scoreAdj, [30000, 10000, -10000, -30000]);
    console.log("testBasic passed");
}

function testShareUma() {
    const args = ["100001", "20000", "100002", "30000", "100003", "25000", "100004", "25000"];
    const result = parseScoreFromRaw(args);
    assert.deepStrictEqual(result.id, ["100002", "100003", "100004", "100001"]);
    assert.deepStrictEqual(result.scoreRaw, [30000, 25000, 25000, 20000]);
    assert.deepStrictEqual(result.scoreAdj, [20000, 0, 0, -20000]);
    console.log("testShareUma passed");
}

function testNegative() {
    const args = ["1","25000","2","25000","3","89000","4","-39000"];
    const result = parseScoreFromRaw(args);
    assert.deepStrictEqual(result.id, ["3", "1", "2", "4"]);
    assert.deepStrictEqual(result.scoreRaw, [89000, 25000, 25000, -39000]);
    assert.deepStrictEqual(result.scoreAdj, [79000, 0, 0, -79000]);
    console.log("testNegative passed");
}



function testIncorrectLength() {
    const args = ["100001", "25000", "100002", "25000"]; // Only 4 values, not 8
    let errorCaught = false;
    try {
        parseScoreFromRaw(args);
    } catch (e: any) {
        if (e.message.includes("Raw Score incorrect length!")) {
            errorCaught = true;
        }
    }
    assert.strictEqual(errorCaught, true, "Expected error for incorrect length");
    console.log("testIncorrectLength passed");
}

function testInvalidNumber() {
    const args = ["100001", "NaN", "100002", "25000", "100003", "25000", "100004", "25000"];
    let errorCaught = false;
    try {
        parseScoreFromRaw(args);
    } catch (e: any){
        if (e.message.includes("Raw Score format error!")) {
            errorCaught = true;
        }
    }
    assert.strictEqual(errorCaught, true, "Expected error for invalid number");
    console.log("testInvalidNumber passed");
}

function testInvalidSum() {
    const args = ["100001", "25000", "100002", "25000", "100003", "25000", "100004", "30000"];
    let errorCaught = false;
    try {
        parseScoreFromRaw(args);
    } catch (e: any) {
        if (e.message.includes("Raw Score sum must be **100000**")) {
            errorCaught = true;
        }
    }
    assert.strictEqual(errorCaught, true, "Expected error for incorrect sum");
    console.log("testInvalidSum passed");
}

function runTests() {
    testBasic();
    testShareUma();
    testNegative();
    testIncorrectLength();
    testInvalidNumber();
    testInvalidSum();
    console.log("All tests passed.");
}

runTests();