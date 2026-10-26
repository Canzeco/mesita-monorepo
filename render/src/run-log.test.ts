import assert from "node:assert/strict";
import test from "node:test";
import { buildCommit, oneLine, runLog, stepsLine, thrownMessage } from "./run-log.ts";

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

test("the start line names the build, and an unknown one says so", () => {
  assert.equal(buildCommit({ RENDER_GIT_COMMIT: "86e0eb9702a0b97b" }), "86e0eb9");
  assert.equal(buildCommit({}), "unknown");
});

test("one steps line carries each step's output and time", () => {
  assert.equal(
    runLog("steps", stepsLine("place-1", [
      { step: "details", ms: 412.4, produced: "ok" },
      { step: "description", ms: 0, produced: "google,kept-saved" },
    ])),
    "[enrich] steps place-1 details=ok(412ms) description=google,kept-saved(0ms)",
  );
});
