import { describe, expect, it } from "vitest";
import { filterLines, type LogLine } from "./filter";

const LINES: LogLine[] = [
  {
    id: "1",
    timestamp: "2026-10-15T20:00:00.000Z",
    message: "[enrich] wrote Strana",
    level: "info",
    task: "enrich-single-place",
    taskRun: "trn-1",
  },
  {
    id: "2",
    timestamp: "2026-10-15T20:01:00.000Z",
    message: "stop enriching failed",
    level: "error",
    task: "enrich-multiple-places",
    taskRun: "trn-2",
  },
];

describe("filterLines", () => {
  it("returns every line when the query is blank", () => {
    expect(filterLines(LINES, "  ")).toEqual(LINES);
  });

  it("matches the message, the level, or the task", () => {
    expect(filterLines(LINES, "strana").map((line) => line.id)).toEqual(["1"]);
    expect(filterLines(LINES, "ERROR").map((line) => line.id)).toEqual(["2"]);
    expect(filterLines(LINES, "multiple").map((line) => line.id)).toEqual(["2"]);
  });
});
