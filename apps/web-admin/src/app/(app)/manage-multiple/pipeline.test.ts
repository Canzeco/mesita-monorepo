import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { LEGACY_HASHES, PIPELINE_STEPS } from "./pipeline";

const here = dirname(fileURLToPath(import.meta.url));

describe("PIPELINE_STEPS", () => {
  it("is Google Search, Mesita Search, Mesita Intake", () => {
    expect(PIPELINE_STEPS.map((s) => s.label)).toEqual([
      "Google Search",
      "Mesita Search",
      "Mesita Intake",
    ]);
    expect(PIPELINE_STEPS.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(new Set(PIPELINE_STEPS.map((s) => s.id)).size).toBe(3);
  });

  it("routes the retired Edit hash onto Mesita Intake", () => {
    expect(LEGACY_HASHES["edit-states"]).toBe("mesita-intake");
  });
});

describe("the page chrome names the three surfaces", () => {
  it("keeps Google Search, Mesita Search, Mesita Intake as one Update box", () => {
    const client = readFileSync(join(here, "MultiplePlacesClient.tsx"), "utf8");
    const intake = readFileSync(join(here, "IntakeTab.tsx"), "utf8");
    const edit = readFileSync(join(here, "EditTab.tsx"), "utf8");
    expect(client).toContain("SearchTab");
    expect(client).toContain("MesitaSearchTab");
    expect(client).toContain("IntakeTab");
    expect(client).not.toContain("EditTab");
    expect(intake).toContain("UpdateFields");
    expect(intake).toContain('label="Update"');
    expect(intake).toContain("runCreateThenEnrich");
    expect(intake).toContain("alreadyExisted");
    expect(intake).toContain("Listed · Active · Verified · Partnered · Promoted");
    expect(intake).toContain("Create + Enrich is create then enrich");
    expect(intake).toContain("Copy failed IDs");
    expect(intake).toContain("Promise.all(ids.map");
    expect(intake).not.toContain("create_enrich");
    expect(intake).not.toContain("EditPanel");
    expect(intake).not.toContain("type-eyebrow");
    expect(intake).not.toContain("CONCURRENCY");
    expect(intake).not.toContain("const worker = async");
    expect(intake).not.toContain("Promoting");
    expect(edit).toContain("Listed");
    expect(edit).toContain("Active");
    expect(edit).toContain("Verified");
    expect(edit).toContain("Partnered");
    expect(edit).toContain("Visit Rewards");
    expect(edit).toContain('value="active"');
    expect(edit).toContain("setPlaceActive");
    expect(edit).toContain('value="promoting"');
    expect(edit).toContain("<option value=\"promoting\">Visit Rewards</option>");
    expect(edit).not.toContain(">Promoting<");
    expect(edit).not.toContain("EditPanel");
  });
});

describe("Mesita Search returns the whole catalog too", () => {
  it("ships an All places button that needs no paste, and never arms Intake", () => {
    const tab = readFileSync(join(here, "MesitaSearchTab.tsx"), "utf8");
    expect(tab).toContain("listAllPlaces");
    expect(tab).toContain("All places");
    // Gated on nothing but a run already in flight — the paste is the OTHER
    // button's input, so requiring IDs here would defeat the point.
    expect(tab).toContain("disabled={busy}");
    // Read-only: the shared ID box feeds Mesita Intake, which WRITES state.
    // An All places run must never load it with every place on Mesita.
    const run = tab.slice(
      tab.indexOf("async function runAllPlaces"),
      tab.indexOf("return (", tab.indexOf("async function runAllPlaces")),
    );
    expect(run).not.toContain("onTextChange");
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
  it("does not mount CostCalculator — Create/Enrich estimates live on Intake", () => {
    const searchTab = readFileSync(join(here, "SearchTab.tsx"), "utf8");
    const intakeTab = readFileSync(join(here, "IntakeTab.tsx"), "utf8");
    const costUi = readFileSync(join(here, "search-cost.tsx"), "utf8");
    expect(searchTab).not.toContain("CostCalculator");
    expect(intakeTab).not.toContain("computeEnrichmentCost");
    expect(intakeTab).not.toContain("costSeed");
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
