// MVP test rule (MESITA-2600): only the money guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WRITE_BOX_ACTIONS } from "./pipeline";
import { enrichOutcomes } from "./enrich-outcome";

const here = dirname(fileURLToPath(import.meta.url));

describe("the write boxes never reach verify, partner or plan", () => {
  it("deletes only behind a confirm and never writes verify, partner or plan (MESITA-1664)", () => {
    const box = readFileSync(join(here, "WriteBox.tsx"), "utf8");
    // MESITA-1664 (decision: Pato) — "place cannot be partner from the
    // console": Active/Verified/Partnered never write from this page's
    // boxes. They wrote from web-business (claim → verify → own → Stripe
    // onboarding) until MESITA-2089 deleted it.
    expect(box).toContain("window.confirm");
    // Delete runs in the box's one batch action (MESITA-3085).
    expect(box).toContain("writePlaces");
    expect(readFileSync(join(here, "actions.ts"), "utf8")).toContain(
      "deletePlace(id)",
    );
    expect(box).not.toContain("Verified");
    expect(box).not.toContain("Partnered");
    expect(box).not.toContain("setPlaceActive");
    expect(box).not.toContain("setPlaceVerified");
    expect(box).not.toContain("setPlacePlan");
    // The box never reaches Stripe; staff Premier left it with the Edit box
    // (MESITA-3159).
    expect(box).not.toContain("stripe");
    // This box never stamps enriched_at (MESITA-2730). Becoming Enriched is
    // the Deep Enrich run.
    expect(box).not.toContain("enriched_at");
  });
});

describe("Mesita Search returns the whole catalog too", () => {
  it("walks the catalog in the EF — paged, batched by a cursor, and honest about the total", () => {
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
    // Keyset by id: each batch starts after the last id, and a full batch
    // hands back `next` so the console reads the whole catalog (MESITA-3595).
    expect(ef).toContain('q.gt("id", cursor)');
    expect(ef).toContain("places, total, next");
    // `total` is what lets the console say a run was truncated.
    expect(ef).toContain('count: "exact", head: true');
    // The two id-scoped side reads ride the URL, so ALL chunks them.
    expect(ef).toContain("chunked(ids, ID_CHUNK)");
  });
});

describe("Google Search is a bar, not a parameter panel", () => {
  it("authors no quality floors", () => {
    const searchTab = readFileSync(join(here, "SearchTab.tsx"), "utf8");
    expect(searchTab).not.toContain("minRating");
    expect(searchTab).not.toContain("minUserRatingCount");
  });
});

describe("paid, visibility and delete writes never run unconfirmed (MESITA-3942)", () => {
  const box = readFileSync(join(here, "WriteBox.tsx"), "utf8");
  const run = box.slice(box.indexOf("async function run("), box.indexOf("function copyIds("));

  it("asks confirmFor before anything runs", () => {
    expect(run).toContain("confirmFor(action, n)");
    expect(run.indexOf("confirmFor(action, n)")).toBeLessThan(run.indexOf("setRunning(action)"));
    expect(run.indexOf("confirmFor(action, n)")).toBeLessThan(run.indexOf("runOnMesita("));
    for (const action of ['"enrich"', '"reviews-update"', '"list"', '"unlist"']) {
      expect(box).toContain(`action === ${action}`);
    }
  });

  it("names the count before Delete and asks for the typed number past 10", () => {
    expect(run).toContain("Delete ${places(n)}? No Undo in this console.");
    expect(run).toContain("window.prompt(");
    expect(run).toContain("parseInt(typed.trim(), 10) !== n");
    expect(run.indexOf("window.prompt(")).toBeLessThan(run.indexOf("setRunning(action)"));
  });

  it("keeps Delete out of Mesita Edit", () => {
    expect(WRITE_BOX_ACTIONS.edit).not.toContain("delete");
  });
});

describe("Deep Enrich never reports a skipped place as started (MESITA-3942)", () => {
  it("maps the EF's skipped ids to skipped, the rest to started", () => {
    expect(Object.fromEntries(enrichOutcomes(["a", "b", "c"], { ok: true, data: { skipped: ["b"] } }))).toEqual({
      a: { ok: true, data: "started" },
      b: { ok: true, data: "skipped" },
      c: { ok: true, data: "started" },
    });
  });

  it("fails every place of a chunk the EF refused", () => {
    expect(Object.fromEntries(enrichOutcomes(["a", "b"], { ok: false, error: "nope" }))).toEqual({
      a: { ok: false, error: "nope" },
      b: { ok: false, error: "nope" },
    });
  });
});
