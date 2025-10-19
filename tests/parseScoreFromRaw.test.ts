import { parseScoreFromRaw } from "../src/cmds/riichidb/score_parser";

describe("parseScoreFromRaw", () => {
    test("parses basic input correctly", () => {
        const args = ["100001", "10000", "100002", "20000", "100003", "30000", "100004", "40000"];
        const result = parseScoreFromRaw(args);
        expect(result.id).toEqual(['100004', '100003', '100002', '100001']);
        expect(result.scoreRaw).toEqual([40000, 30000, 20000, 10000]);
        expect(result.scoreAdj).toEqual([30000, 10000, -10000, -30000]);
    });

    test("handles shared uma correctly", () => {
        const args = ["100001", "20000", "100002", "30000", "100003", "25000", "100004", "25000"];
        const result = parseScoreFromRaw(args);
        expect(result.id).toEqual(["100002", "100003", "100004", "100001"]);
        expect(result.scoreRaw).toEqual([30000, 25000, 25000, 20000]);
        expect(result.scoreAdj).toEqual([20000, 0, 0, -20000]);
    });

    test("handles negative scores", () => {
        const args = ["1","25000","2","25000","3","89000","4","-39000"];
        const result = parseScoreFromRaw(args);
        expect(result.id).toEqual(["3", "1", "2", "4"]);
        expect(result.scoreRaw).toEqual([89000, 25000, 25000, -39000]);
        expect(result.scoreAdj).toEqual([79000, 0, 0, -79000]);
    });

    test("throws error on incorrect length", () => {
        const args = ["100001", "25000", "100002", "25000"]; // only 4 items
        expect(() => parseScoreFromRaw(args)).toThrow("Raw Score incorrect length!");
    });

    test("throws error on invalid number", () => {
        const args = ["100001", "NaN", "100002", "25000", "100003", "25000", "100004", "25000"];
        expect(() => parseScoreFromRaw(args)).toThrow("Raw Score format error!");
    });

    test("throws error when sum of scores is incorrect", () => {
        const args = ["100001", "25000", "100002", "25000", "100003", "25000", "100004", "30000"];
        expect(() => parseScoreFromRaw(args)).toThrow("Raw Score sum must be **100000**");
    });
});
