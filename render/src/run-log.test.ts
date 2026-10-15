import assert from "node:assert/strict";
import test from "node:test";
import { oneLine, runLog, thrownMessage } from "./run-log.ts";

test("a vendor body is one line", () => {
  const body = '{\n  "error": {\n    "type": "platform-feature-disabled",\n    "message": "Too many outstanding invoices"\n  }\n}';
  assert.equal(oneLine(body).includes("\n"), false);
  assert.match(oneLine(body), /Too many outstanding invoices/);
});

test("a run logs start, finish, and the error on one line", () => {
  assert.equal(runLog("start", "place-1"), "[enrich] start place-1");
  assert.equal(runLog("finished", "place-1"), "[enrich] finished place-1");
  assert.equal(
    runLog("error", "place-1: Apify did not return Google reviews.\n{\n  \"error\": true\n}"),
    '[enrich] error place-1: Apify did not return Google reviews. { "error": true }',
  );
});

test("a thrown error keeps its message", () => {
  assert.equal(thrownMessage(new Error("write place failed (500)")), "write place failed (500)");
  assert.equal(thrownMessage("nope"), "nope");
});
