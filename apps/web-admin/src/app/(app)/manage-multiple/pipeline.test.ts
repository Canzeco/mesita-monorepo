import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { LEGACY_HASHES, PIPELINE_STEPS } from "./pipeline";

const here = dirname(fileURLToPath(import.meta.url));

describe("PIPELINE_STEPS", () => {
  it("is Google Search, Mesita Search, Crenup", () => {
    expect(PIPELINE_STEPS.map((s) => s.label)).toEqual([
      "Google Search",
      "Mesita Search",
      "Crenup",
    ]);
    expect(PIPELINE_STEPS.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(new Set(PIPELINE_STEPS.map((s) => s.id)).size).toBe(3);
  });

  it("routes the retired Edit hash onto Crenup", () => {
    expect(LEGACY_HASHES["edit-states"]).toBe("crenup");
  });
});

describe("the page chrome names the three surfaces", () => {
  it("keeps Google Search, Mesita Search, Crenup — Crenup is five flat actions, no Update, no EditTab", () => {
    const client = readFileSync(join(here, "MultiplePlacesClient.tsx"), "utf8");
    const Crenup = readFileSync(join(here, "CrenupTab.tsx"), "utf8");
    expect(client).toContain("SearchTab");
    expect(client).toContain("MesitaSearchTab");
    expect(client).toContain("CrenupTab");
    expect(client).not.toContain("EditTab");
    // MESITA-1664 (decision: Pato) — "place cannot be partner from the
    // console": Active/Verified/Partnered write from web-business now
    // (claim → verify → own → Stripe onboarding), never from admin.
    expect(Crenup).toContain('label="Create"');
    expect(Crenup).toContain('label="Delete"');
    expect(Crenup).toContain('label="List"');
    expect(Crenup).toContain('label="Unlist"');
    expect(Crenup).toContain('label="Enrich"');
    expect(Crenup).toContain("alreadyExisted");
    expect(Crenup).toContain("Copy failed IDs");
    expect(Crenup).toContain("Promise.all(ids.map");
    expect(Crenup).toContain("window.confirm");
    expect(Crenup).toContain("deletePlace");
    expect(Crenup).toContain("setPlaceListed");
    expect(Crenup).not.toContain("EditTab");
    expect(Crenup).not.toContain("UpdateFields");
    expect(Crenup).not.toContain('label="Update"');
    expect(Crenup).not.toContain("create_then_enrich");
    expect(Crenup).not.toContain("create_enrich");
    expect(Crenup).not.toContain("EditPanel");
    expect(Crenup).not.toContain("type-eyebrow");
    expect(Crenup).not.toContain("CONCURRENCY");
    expect(Crenup).not.toContain("const worker = async");
    expect(Crenup).not.toContain("Promoting");
    expect(Crenup).not.toContain("Verified");
    expect(Crenup).not.toContain("Partnered");
    expect(Crenup).not.toContain("setPlaceActive");
    expect(Crenup).not.toContain("setPlaceVerified");
    expect(Crenup).not.toContain("setPlacePlan");
  });
});

describe("Mesita Search returns the whole catalog too", () => {
  it("ships an All places button that needs no paste, and loads the shared box", () => {
    const tab = readFileSync(join(here, "MesitaSearchTab.tsx"), "utf8");
    expect(tab).toContain("listAllPlaces");
    expect(tab).toContain("All places");
    // Gated on nothing but a run already in flight — the paste is the OTHER
    // button's input, so requiring IDs here would defeat the point.
    expect(tab).toContain("disabled={busy}");
    // The shortcut: the run loads the shared ID box with the catalog's Google
    // Place IDs, so Crenup is one scroll away with no paste. Capped
    // where the box caps, and a place with no google_place_id is skipped.
    const run = tab.slice(
      tab.indexOf("async function runAllPlaces"),
      tab.indexOf("return (", tab.indexOf("async function runAllPlaces")),
    );
    expect(run).toContain("onTextChange(");
    expect(run).toContain("google_place_id");
    expect(run).toContain("MAX_GOOGLE_PLACE_IDS");
  });

  it("walks the catalog in the EF — paged, capped, and honest about the cap", () => {
    const ef = readFileSync(
      join(
        here,
        "../../../../../../supabase/supabase/functions/admin-web-search-places/index.ts",
      ),
      "utf8",
    );
    expect(ef).toContain("all?: unknown");
    expect(ef).toContain("bodyRes.body.all === true");
    // Pages, because PostgREST caps one response at db.max_rows.
    expect(ef).toContain("ALL_PAGE_SIZE");
    expect(ef).toContain("ALL_MAX_ROWS");
    expect(ef).toContain(".range(from, to)");
    // `total` is what lets the console say a run was truncated.
    expect(ef).toContain('count: "exact", head: true');
    expect(ef).toContain("places, total");
    // The two id-scoped side reads ride the URL, so ALL chunks them.
    expect(ef).toContain("chunked(ids, ID_CHUNK)");
  });
});

describe("spend calculator stays off this page", () => {
  it("does not mount CostCalculator — Create/Enrich estimates live on Crenup", () => {
    const searchTab = readFileSync(join(here, "SearchTab.tsx"), "utf8");
    const crenupTab = readFileSync(join(here, "CrenupTab.tsx"), "utf8");
    const costUi = readFileSync(join(here, "search-cost.tsx"), "utf8");
    expect(searchTab).not.toContain("CostCalculator");
    expect(crenupTab).not.toContain("computeEnrichmentCost");
    expect(crenupTab).not.toContain("costSeed");
    expect(costUi).not.toContain("export function CostCalculator");
  });
});

describe("Google Search is a bar, not a parameter panel", () => {
  it("keeps Results in the footer and does not author quality floors", () => {
    const searchTab = readFileSync(join(here, "SearchTab.tsx"), "utf8");
    const constants = readFileSync(join(here, "search-tab-constants.ts"), "utf8");
    const rows = readFileSync(join(here, "SearchQueryRows.tsx"), "utf8");
    expect(searchTab).toContain("RESULTS_OPTIONS");
    expect(searchTab).toContain("textarea");
    expect(searchTab).toContain("one query per line");
    expect(constants).toContain('{ label: "1", value: 1 }');
    expect(searchTab).toContain("DISCOVERY_MAP_HREF");
    expect(readFileSync(join(here, "../filters-config/nav.ts"), "utf8")).toContain(
      "/filters-config/modes#s-map",
    );
    expect(searchTab).not.toContain("SearchParametersSection");
    expect(searchTab).not.toContain("minRating");
    expect(searchTab).not.toContain("minUserRatingCount");
    expect(constants).not.toContain("RATING_OPTIONS");
    expect(constants).not.toContain("REVIEW_OPTIONS");
    expect(rows).toContain("DISCOVERY_MAP_HREF");
    expect(rows).not.toContain("Loosen the filters");
    expect(rows).toContain("This row only");
  });
});
