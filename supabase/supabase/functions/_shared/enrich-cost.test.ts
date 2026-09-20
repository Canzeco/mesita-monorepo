import { assertEquals } from "jsr:@std/assert";
import { COST } from "./enrich-config.ts";
import {
  chargeGoogleSpine,
  createEnrichCostLedger,
  discoverySearchCost,
  googleMapsRunCost,
  googleSpineCost,
  instagramRunCost,
  isEnrichCostCapError,
  runOwnsGatherSpend,
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
  // The ledger rounds every running total to 4 decimals, so a charge carrying
  // a 5th (the GMaps run does: the actor-start fee is $0.00005) lands rounded.
  // Worth knowing before reading a per-event total as exact — the start fee
  // is below the ledger's own resolution and can never move a sum on its own.
  const gmaps = googleMapsRunCost(100, 10);
  const gmapsBooked = Math.round(gmaps * 1e4) / 1e4;
  assertEquals(gmapsBooked, 0.0611);

  const research = createEnrichCostLedger(1.0);
  research.charge("gmaps", gmaps);
  const analysis = createEnrichCostLedger(1.0, research.snapshot());
  assertEquals(analysis.spentUsd, gmapsBooked);
  analysis.charge("sort", COST.sort);
  assertEquals(analysis.spentUsd, Math.round((gmapsBooked + COST.sort) * 1e4) / 1e4);
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

Deno.test("googleMapsRunCost: priced per review, not per run", () => {
  // The live config: atlasGatherReviews 100, atlasGatherGoogleImages 10.
  // Apify bills start + place + details + $0.0005 per review + $0.0005 per
  // image, so ~6 cents — NOT the flat $0.30 this replaced, and not the
  // ~$0.65 the old comment claimed by pricing reviews per hundred instead of
  // per thousand (MESITA-2032).
  assertEquals(googleMapsRunCost(100, 10), 0.06105);

  // It MOVES with the knob. A flat constant cannot, which is the whole
  // defect: halving the review count has to halve the review line.
  assertEquals(
    Math.round((googleMapsRunCost(100, 10) - googleMapsRunCost(50, 10)) * 1e5) / 1e5,
    0.025,
  );

  // Floor: a scrape that returned nothing still pays start + place + details.
  assertEquals(googleMapsRunCost(0, 0), COST.gmapsStart + COST.gmapsPlace + COST.gmapsDetails);
  // Negative counts cannot credit the ledger.
  assertEquals(googleMapsRunCost(-5, -5), googleMapsRunCost(0, 0));
});

Deno.test("runOwnsGatherSpend: only a run that walked from research is billed", () => {
  // The bug this replaces was a tautology, so the case that matters is the
  // POSITIVE one: a full run must record its cost. The old check
  // (`row.stage === "contents"`) answered false here — inside the contents EF
  // `row.stage` is always "contents", because loadClaimedRow refuses the row
  // otherwise — so every successful run wrote cost_usd = null.
  assertEquals(runOwnsGatherSpend("research"), true);

  // A light re-enrich reused a gather it never paid for.
  assertEquals(runOwnsGatherSpend("analysis"), false);
  assertEquals(runOwnsGatherSpend("contents"), false);

  // Unknown (no run row, or the read failed) bills rather than drops: losing
  // the number is the failure being fixed, so unknown fails toward recording.
  assertEquals(runOwnsGatherSpend(null), true);
  assertEquals(runOwnsGatherSpend(undefined), true);
});

Deno.test("a stage EF never decides anything from row.stage — loadClaimedRow pinned it", () => {
  // The guard for the SHAPE of the bug, not just its instance.
  //
  // `serveEnrichStage` calls `loadClaimedRow(admin, placeId, stage)`, which
  // refuses the row unless `row.stage` already equals the stage being served.
  // So inside any stage EF, `row.stage` is a constant, and every branch on it
  // is dead one way or the other. The cost ledger branched on it and silently
  // wrote `cost_usd = null` for every successful run (MESITA-2032).
  //
  // A reviewer cannot see this: the line reads like a real condition, and both
  // the type checker and every test were happy. Only the invariant two files
  // away makes it a tautology. So assert on the source.
  for (
    const stage of ["research", "analysis", "contents"] as const
  ) {
    const src = Deno.readTextFileSync(
      new URL(`../supabase-cron-enrich-place-${stage}/index.ts`, import.meta.url),
    );
    const offenders = src.split("\n")
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => /\brow\.stage\s*[=!]==/.test(line));
    assertEquals(
      offenders,
      [],
      `${stage}/index.ts branches on row.stage, which loadClaimedRow has already ` +
        `fixed to "${stage}" — the comparison is always known. Ask the run row ` +
        `(entry_stage) or the payload instead: ${JSON.stringify(offenders)}`,
    );
  }
});
