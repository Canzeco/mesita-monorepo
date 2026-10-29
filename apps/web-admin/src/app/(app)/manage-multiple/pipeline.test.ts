// MVP test rule (MESITA-2600): only the money guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("the page chrome names the five surfaces", () => {
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
    // Operator Premier grants are allowed here (Pato, 2026-10-29,
    // MESITA-3090): they charge no one, and premier_set_grant refuses every
    // place a guest pays for, waits to pay for or is checking out on. The box
    // itself never reaches Stripe.
    expect(box).not.toContain("stripe");
    // This box never stamps enriched_at (MESITA-2730). Becoming Enriched is
    // the Enrich box.
    expect(box).not.toContain("enriched_at");
  });
});

describe("Mesita Search returns the whole catalog too", () => {
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

describe("Google Search is a bar, not a parameter panel", () => {
  it("authors no quality floors", () => {
    const searchTab = readFileSync(join(here, "SearchTab.tsx"), "utf8");
    expect(searchTab).not.toContain("minRating");
    expect(searchTab).not.toContain("minUserRatingCount");
  });
});
