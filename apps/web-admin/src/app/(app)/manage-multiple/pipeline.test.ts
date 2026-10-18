import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { LEGACY_HASHES, PIPELINE_STEPS, WRITE_BOX_ACTIONS } from "./pipeline";

const here = dirname(fileURLToPath(import.meta.url));

describe("PIPELINE_STEPS", () => {
  it("is Google Search, Mesita Search, Create, Enrich, Edit", () => {
    expect(PIPELINE_STEPS.map((s) => s.label)).toEqual([
      "Google Search",
      "Mesita Search",
      "Create",
      "Enrich",
      "Edit",
    ]);
    expect(PIPELINE_STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(PIPELINE_STEPS.map((s) => s.id)).size).toBe(5);
  });

  it("routes every retired hash onto a box that exists", () => {
    const ids = new Set<string>(PIPELINE_STEPS.map((s) => s.id));
    for (const dest of Object.values(LEGACY_HASHES)) expect(ids.has(dest)).toBe(true);
    expect(LEGACY_HASHES["crenup"]).toBe("create");
    expect(LEGACY_HASHES["bulk-enrich"]).toBe("enrich");
    expect(LEGACY_HASHES["edit-states"]).toBe("update");
  });

  it("gives each write box its own buttons — Edit is a box, never a button", () => {
    expect(WRITE_BOX_ACTIONS).toEqual({
      create: ["create"],
      enrich: ["enrich"],
      update: ["list", "unlist", "delete"],
    });
    const all: string[] = Object.values(WRITE_BOX_ACTIONS).flat();
    expect(all).toHaveLength(new Set(all).size);
  });
});

describe("the page chrome names the five surfaces", () => {
  it("keeps Google Search, Mesita Search and three WriteBoxes — five flat actions, no Update button, no EditTab", () => {
    const client = readFileSync(join(here, "MultiplePlacesClient.tsx"), "utf8");
    const box = readFileSync(join(here, "WriteBox.tsx"), "utf8");
    expect(client).toContain("SearchTab");
    expect(client).toContain("MesitaSearchTab");
    expect(client.match(/<WriteBox\b/g)).toHaveLength(3);
    expect(client).toContain("WRITE_BOX_ACTIONS.create");
    expect(client).toContain("WRITE_BOX_ACTIONS.enrich");
    expect(client).toContain("WRITE_BOX_ACTIONS.update");
    expect(client).not.toContain("EditTab");
    // MESITA-1664 (decision: Pato) — "place cannot be partner from the
    // console": Active/Verified/Partnered never write from this page's
    // boxes. They wrote from web-business (claim → verify → own → Stripe
    // onboarding) until MESITA-2089 deleted it.
    expect(box).toContain('label: "Create"');
    expect(box).toContain('label: "Delete"');
    expect(box).toContain('label: "Enable"');
    expect(box).toContain('label: "Disable"');
    expect(box).toContain('label: "Enrich"');
    expect(box).toContain("alreadyExisted");
    expect(box).toContain("Copy failed IDs");
    expect(box).toContain("Promise.all(ids.map");
    expect(box).toContain("window.confirm");
    expect(box).toContain("deletePlace");
    expect(box).toContain("setPlaceListed");
    expect(box).not.toContain("EditTab");
    expect(box).not.toContain("UpdateFields");
    expect(box).not.toContain('label: "Update"');
    expect(box).not.toContain("create_then_enrich");
    expect(box).not.toContain("create_enrich");
    expect(box).not.toContain("EditPanel");
    expect(box).not.toContain("type-eyebrow");
    expect(box).not.toContain("CONCURRENCY");
    expect(box).not.toContain("const worker = async");
    expect(box).not.toContain("Promoting");
    expect(box).not.toContain("Verified");
    expect(box).not.toContain("Partnered");
    expect(box).not.toContain("setPlaceActive");
    expect(box).not.toContain("setPlaceVerified");
    expect(box).not.toContain("setPlacePlan");
  });

  it("never shows the word Crenup (MESITA-2096)", () => {
    for (const file of [
      "layout.tsx",
      "MultiplePlacesClient.tsx",
      "PipelineNav.tsx",
      "SearchTab.tsx",
      "MesitaSearchResults.tsx",
      "WriteBox.tsx",
    ]) {
      const src = readFileSync(join(here, file), "utf8");
      const visible = src
        .split("\n")
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join("\n")
        .match(/(["'`>][^"'`<]*\bCrenup\b[^"'`<]*)/g);
      expect(visible, file).toBeNull();
    }
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
    // Place IDs, so Create, Enrich and Update are one scroll away with no paste. Capped
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
  it("does not mount CostCalculator — Create/Enrich estimates live on Configurations", () => {
    const searchTab = readFileSync(join(here, "SearchTab.tsx"), "utf8");
    const writeBox = readFileSync(join(here, "WriteBox.tsx"), "utf8");
    const costUi = readFileSync(join(here, "search-cost.tsx"), "utf8");
    expect(searchTab).not.toContain("CostCalculator");
    expect(writeBox).not.toContain("computeEnrichmentCost");
    expect(writeBox).not.toContain("costSeed");
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
      "/filters-config#s-area",
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
