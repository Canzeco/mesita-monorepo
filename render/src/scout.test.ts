import assert from "node:assert/strict";
import test from "node:test";
import { capSummary, scoutPlace, SCOUT_WORD_CAP } from "./scout.ts";

function agentReply(answer: unknown): Response {
  return Response.json({
    output: [{ type: "message", content: [{ text: JSON.stringify(answer) }] }],
  });
}

test("the Scout sends the job's message and instructions, and reports the words it wrote", async () => {
  let sent: { input?: string; instructions?: string; preset?: string; max_steps?: number } = {};
  const fetchImpl: typeof fetch = async (_input, init) => {
    sent = JSON.parse(String(init?.body ?? "{}"));
    return agentReply({ summary: "A seafood lunch spot with a long line and a famous tuna tostada." });
  };
  const out = await scoutPlace({
    input: 'Research the place "Contramar".',
    instructions: "Write one short paragraph.",
    preset: "pro-search",
    perplexityKey: "px",
    fetchImpl,
  });
  assert.equal(sent.input, 'Research the place "Contramar".');
  assert.equal(sent.instructions, "Write one short paragraph.");
  assert.equal(sent.preset, "pro-search");
  assert.equal(sent.max_steps, 6);
  assert.equal(out.summary, "A seafood lunch spot with a long line and a famous tuna tostada.");
  assert.equal(out.report.state, "completed");
  assert.match(out.report.detail, /13 words/);
});

test("a null summary is a result; no answer is a failure", async () => {
  const nothing = await scoutPlace({
    input: "x",
    instructions: "y",
    perplexityKey: "px",
    fetchImpl: async () => agentReply({ summary: null }),
  });
  assert.equal(nothing.summary, null);
  assert.equal(nothing.report.state, "completed");

  const down = await scoutPlace({
    input: "x",
    instructions: "y",
    perplexityKey: "px",
    fetchImpl: async () => new Response("busy", { status: 503 }),
  });
  assert.equal(down.summary, null);
  assert.equal(down.report.state, "failed");
});

test("a missing key or missing instructions fail without a request", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("no request expected");
  };
  assert.equal((await scoutPlace({ input: "x", instructions: "y", fetchImpl })).report.state, "failed");
  assert.equal((await scoutPlace({ input: "x", perplexityKey: "px", fetchImpl })).report.state, "failed");
});

test("the summary is capped in words and a literal null is no summary", () => {
  const long = Array.from({ length: 200 }, (_, i) => `w${i}`).join(" ");
  assert.equal(capSummary(long)?.split(" ").length, SCOUT_WORD_CAP);
  assert.equal(capSummary("null"), null);
  assert.equal(capSummary("  "), null);
  assert.equal(capSummary(42), null);
});
