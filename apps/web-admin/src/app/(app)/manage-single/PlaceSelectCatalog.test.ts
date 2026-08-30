import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("Manage Single quick-view columns", () => {
  it("is the pipeline block then the commercial block, with Created dropped", () => {
    const src = readFileSync(join(here, "PlaceSelectCatalog.tsx"), "utf8");
    const headers = [
      ...src.matchAll(
        /<th className="px-4 py-3 text-center font-semibold(?: whitespace-nowrap)?">([\w ]+)<\/th>/g,
      ),
    ].map((m) => m[1]);
    // Pato, 2026-08-29: show almost all the statuses here. PIPELINE first
    // ("how far along is it"), then COMMERCIAL ("how much does it offer").
    // Created is the ONE deliberate omission — google_place_id is required
    // at create, so that column read Yes on every row and carried no signal.
    expect(headers).toEqual([
      "Active",
      "Listed",
      "Requested",
      "Enriched",
      "Enriching",
      "Verified",
      "Offerings",
      "Partner",
      "Visit Rewards",
      "Mesita Pay",
      "Mesita Yums",
    ]);
    expect(headers).not.toContain("Created");
    // "promo" is banned in copy (Pato, 2026-08-30) — the wire key stays.
    expect(headers).not.toContain("Promotion");
    // The score cell derives nothing itself — the number is shaped
    // server-side (promotion-score.ts twins) and rendered against the max.
    expect(src).toContain("PromotionCell");
    expect(src).toContain("PROMOTION_SCORE_MAX");
    expect(src).toContain("place.promotion");
    // Visit Rewards keeps the operator 0|1|2 collapse and two-rung ticks.
    expect(src).toContain("operatorPromotingLevel");
    expect(src).toContain("[1, 2].map");
    expect(src).not.toContain("[1, 2, 3].map");
    // The pipeline cells render real derivations, not placeholders.
    expect(src).toContain("ActiveCell");
    expect(src).toContain("RequestCountCell");
    expect(src).toContain("place.request_count");
    expect(src).toContain("place.enrich_pulse");
    // Requested is a COUNT, never a Yes/No pill.
    expect(src).not.toMatch(/BoolCell value=\{place\.requested\}/);
  });
});

describe("Manage Single search chrome", () => {
  const src = readFileSync(join(here, "PlaceSelectCatalog.tsx"), "utf8");

  it("does not repeat the page title as a Searching eyebrow", () => {
    expect(src).not.toContain("Manage Single Place results");
    expect(src).not.toContain("Google results · Searching");
  });

  it("fits loading and empty states to content — no padded empty sheet", () => {
    expect(src).not.toMatch(/py-12/);
    expect(src).not.toMatch(/min-h-\[70%\]/);
    expect(src).not.toMatch(/h-\[70%\]/);
    expect(src).toContain("searchOnQuery: false");
    expect(src).toContain("Name Deep Search");
    expect(src).toContain("awaitingHits");
    expect(src).not.toContain("Looking up Google Places");
    expect(src).not.toContain("Not on Mesita");
  });
});

describe("admin-web-search-places ships the acceptance bits and the score", () => {
  it("reads the four bits off places (never profiles) and shapes the quick-view keys", () => {
    const ef = readFileSync(
      join(
        here,
        "../../../../../../supabase/supabase/functions/admin-web-search-places/index.ts",
      ),
      "utf8",
    );
    // The side-read is the admin-only path; the profiles view is anon-readable
    // and must never carry these columns.
    expect(ef).toContain(
      '"id, enrichment, mesita_pay_enabled, yums_enabled, pickup_orders_enabled, delivery_orders_enabled"',
    );
    expect(ef).toContain("mesita_pay:");
    expect(ef).toContain("yums:");
    expect(ef).toContain("pickup:");
    expect(ef).toContain("delivery:");
    // The Promotion score is shaped server-side from the shared twin, so the
    // catalog column and the Partner tab's Promos bar agree by construction.
    expect(ef).toContain("promotion: promotionScore(");
    const cols = ef.match(/const cols =\s*"([^"]+)"/)?.[1] ?? "";
    expect(cols).not.toContain("mesita_pay_enabled");
    expect(cols).not.toContain("yums_enabled");
    expect(cols).not.toContain("pickup_orders_enabled");
    expect(cols).not.toContain("delivery_orders_enabled");
  });
});

describe("admin-web-suggest-places uses Name Deep Search", () => {
  it("calls runConsumerSearchLane in deep mode", () => {
    const ef = readFileSync(
      join(
        here,
        "../../../../../../supabase/supabase/functions/admin-web-suggest-places/index.ts",
      ),
      "utf8",
    );
    expect(ef).toContain("runConsumerSearchLane");
    expect(ef).toContain('mode: typeof body.mode === "string" ? body.mode : "deep"');
    expect(ef).not.toContain('from "../_shared/suggest-places.ts"');
  });
});
