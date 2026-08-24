import { assertEquals } from "jsr:@std/assert";
import { COST } from "./enrich-config.ts";
import {
  chargeGoogleSpine,
  createEnrichCostLedger,
  discoverySearchCost,
  googleSpineCost,
  instagramRunCost,
  isEnrichCostCapError,
  synthesisRunCost,
  visionRunCost,
} from "./enrich-cost.ts";

Deno.test("ledger: charges accumulate and snapshot", () => {
  const ledger = createEnrichCostLedger(1.0);
  ledger.charge("a", 0.1);
  ledger.charge("b", 0.25);
  assertEquals(ledger.spentUsd, 0.35);
  assertEquals(ledger.snapshot(), {
    spentUsd: 0.35,
    charges: [
      { key: "a", usd: 0.1 },
      { key: "b", usd: 0.25 },
    ],
  });
});

Deno.test("ledger: a dollar cap does not abort a run", () => {
  const ledger = createEnrichCostLedger(0.05);
  ledger.charge("seed", 0.04);
  ledger.assertCanAfford(0.02, "next");
  ledger.charge("over", 0.02);
  assertEquals(ledger.spentUsd, 0.06);
  assertEquals(ledger.charges.length, 2);
  assertEquals(isEnrichCostCapError(new Error("nope")), false);
});

Deno.test("ledger: cap 0 still records paid steps", () => {
  const ledger = createEnrichCostLedger(0);
  ledger.assertCanAfford(COST.perplexity, "serp");
  ledger.charge("serp", COST.perplexity);
  assertEquals(ledger.spentUsd, COST.perplexity);
});

Deno.test("ledger: resumes from prior snapshot across stages", () => {
  const research = createEnrichCostLedger(1.0);
  research.charge("compass", COST.compass);
  const analysis = createEnrichCostLedger(1.0, research.snapshot());
  assertEquals(analysis.spentUsd, COST.compass);
  analysis.charge("sort", COST.sort);
  assertEquals(analysis.spentUsd, COST.compass + COST.sort);
});

Deno.test("helpers: google spine / IG / vision / synth / discovery", () => {
  const spine = googleSpineCost(2);
  assertEquals(spine, COST.googleDetails + COST.googleTimezone + COST.googlePhoto * 2);
  const ledger = createEnrichCostLedger(1.0);
  chargeGoogleSpine(ledger, 2);
  // Ledger rounds to 4dp — compare the booked amount, not the raw float sum.
  assertEquals(ledger.spentUsd, Math.round(spine * 10_000) / 10_000);
  assertEquals(instagramRunCost(10), COST.instagramProfile + COST.instagramPost * 10 + COST.instagramVerify);
  assertEquals(visionRunCost(5, "economy"), COST.visionPerImage * 5);
  assertEquals(visionRunCost(5, "standard"), COST.visionPerImageStandard * 5);
  assertEquals(synthesisRunCost("economy"), COST.synthesisEconomy);
  assertEquals(synthesisRunCost("high"), COST.synthesisStandard);
  assertEquals(
    discoverySearchCost({
      discoverCandidates: {
        website_url: 5,
        instagram_url: 0,
        facebook_url: 3,
        opentable_url: 0,
        uber_eats_url: 2,
      },
    }),
    COST.firecrawlSearch * 3,
  );
});
