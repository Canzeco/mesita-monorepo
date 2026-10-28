import assert from "node:assert/strict";
import test from "node:test";
import {
  APIFY_USD,
  charge,
  CostLedger,
  firecrawlCredits,
  inStep,
  openaiUsd,
  PERPLEXITY_CALL_FALLBACK_USD,
  perplexityUsd,
  roundUsd,
  syncSourcesUsd,
} from "./cost.ts";

test("OpenAI is tokens × the per-million rate, and an unknown model is not free", () => {
  // gpt-4o-mini: $0.15 in, $0.60 out per 1M.
  assert.equal(roundUsd(openaiUsd("gpt-4o-mini", { prompt_tokens: 1_000_000, completion_tokens: 500_000 })), 0.45);
  assert.equal(openaiUsd("text-embedding-3-small", { prompt_tokens: 500 }), 0.00001);
  assert.equal(openaiUsd("gpt-4o-mini", undefined), 0);
  assert.ok(openaiUsd("some-new-model", { prompt_tokens: 1000 }) > openaiUsd("gpt-4o-mini", { prompt_tokens: 1000 }));
});

test("Perplexity's own cost wins; without one the call is the fallback", () => {
  assert.deepEqual(perplexityUsd({ usage: { cost: { total_cost: 0.0123 } } }), { usd: 0.0123, reported: true });
  assert.deepEqual(perplexityUsd({ output: [] }), { usd: PERPLEXITY_CALL_FALLBACK_USD, reported: false });
  assert.deepEqual(perplexityUsd(null), { usd: PERPLEXITY_CALL_FALLBACK_USD, reported: false });
});

test("Firecrawl credits come from the response, else 2 per 10 results asked", () => {
  assert.equal(firecrawlCredits({ creditsUsed: 4 }, 5), 4);
  assert.equal(firecrawlCredits({}, 5), 2);
  assert.equal(firecrawlCredits({}, 20), 4);
});

test("Sync charges Apify only for the sources it synced", () => {
  const sources = [
    { source: "google", status: "synced" },
    { source: "google_reviews", status: "synced" },
    { source: "instagram", status: "error" },
    { source: "facebook", status: "synced" },
  ];
  const got = syncSourcesUsd(sources, 100);
  assert.equal(
    roundUsd(got.usd),
    roundUsd(APIFY_USD.googleMapsPlace + 100 * APIFY_USD.googleMapsReview + APIFY_USD.facebookPage),
  );
  assert.equal(got.basis, "google_reviews:100 facebook");
  assert.deepEqual(syncSourcesUsd(undefined, 0), { usd: 0, basis: "none" });
});

test("charges land on the step they ran in, even with two runs interleaved", async () => {
  const a = new CostLedger();
  const b = new CostLedger();
  await Promise.all([
    inStep(a, "serp", async () => {
      await new Promise((r) => setTimeout(r, 5));
      charge("perplexity", 0.01, "scout");
    }),
    inStep(b, "links", async () => {
      charge("firecrawl", 0.002, "search");
      charge("firecrawl", 0.002, "search");
    }),
    inStep(a, "images", async () => charge("openai", 0.0001, "vision")),
  ]);
  charge("openai", 1, "outside any run");
  assert.deepEqual(a.byStep(), [
    { step: "images", vendor: "openai", usd: 0.0001, calls: 1 },
    { step: "serp", vendor: "perplexity", usd: 0.01, calls: 1 },
  ]);
  assert.deepEqual(b.byStep(), [{ step: "links", vendor: "firecrawl", usd: 0.004, calls: 2 }]);
  assert.equal(b.totalUsd(), 0.004);
});
