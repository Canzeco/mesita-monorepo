import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PlaceHit } from "@/app/(app)/manage-multiple/actions";
import type { FindResult, FindRow } from "./find-results";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { FindResults } from "./FindResults";

const G1 = "ChIJAAAAAAAAAAAAAAAAAAAAAA";
const G2 = "ChIJBBBBBBBBBBBBBBBBBBBBBB";

function row(over: Partial<FindRow>): FindRow {
  return {
    key: G1,
    googleId: G1,
    mesitaId: "mesita-a",
    held: true,
    name: "Café Nin",
    address: "Calle Havre 73, Juárez",
    rating: null,
    reviews: null,
    placeHit: null,
    ranks: { catalogue: 1, autocomplete: 2, text: 1 },
    ...over,
  };
}

function placeHit(over: Partial<PlaceHit> = {}): PlaceHit {
  return {
    id: "mesita-a",
    slug: null,
    name: "Café Nin",
    google_name: "Cafe Nin",
    category: null,
    category_label: null,
    state: null,
    address: "Calle Havre 73",
    photo: null,
    zone: null,
    google_stars_overall: null,
    google_review_count: null,
    google_found: false,
    instagram_found: false,
    facebook_found: false,
    content_state: null,
    google_place_id: G1,
    seeded: true,
    listed: true,
    requested: false,
    request_count: 0,
    enriching: false,
    enriched: false,
    enriched_at: null,
    selected: false,
    business_state: "OPERATIONAL",
    business_state_at: null,
    enrich_crenup: 1,
    enrich_crenup_total: 8,
    enrich_crenup_labels: [],
    enrich_crenup_blocked: null,
    ...over,
  };
}

const HELD = row({});
const NEW = row({
  key: G2,
  googleId: G2,
  mesitaId: null,
  held: false,
  name: "Dos Amores Brunch & Meal",
  address: "Parque Central 455",
  rating: 4.7,
  reviews: 266,
  ranks: { catalogue: null, autocomplete: 1, text: 2 },
});

function render(
  result: FindResult,
  over: Partial<Parameters<typeof FindResults>[0]> = {},
) {
  return renderToStaticMarkup(
    <FindResults
      query="dos amores"
      result={result}
      added={new Map()}
      notes={{}}
      disabled={false}
      onOpen={() => {}}
      onAdd={() => {}}
      {...over}
    />,
  );
}

const OK: FindResult = { rows: [HELD, NEW], failed: [], notes: [] };

describe("Find › one table", () => {
  it("draws state columns for the catalogue list, and no rank columns", () => {
    const html = render(
      { rows: [HELD], failed: [], notes: [{ tone: "muted", text: "Mesita only. Google was not asked." }] },
      { query: "", variant: "catalogue" },
    );
    expect(html).not.toContain(">Catalogue<");
    expect(html).not.toContain(">Google<");
    expect(html).not.toContain("Catalogue #1");
    expect(html).toContain("Every place on Mesita, with its states");
    expect(html).not.toContain("General States");
    expect(html).not.toContain("Enrichment Steps");
    expect(html).not.toContain(">Reviews<");
    expect(html).toContain(">Created<");
    expect(html).not.toContain(">Google Found<");
    expect(html).not.toContain(">Instagram Found<");
    expect(html).not.toContain(">Facebook Found<");
    expect(html).toContain(">Open<");
    expect(html).toContain(">Enrich<");
    expect(html).not.toContain(">On Mesita<");
    expect(html).toContain(">Mesita</span>");
    expect(html).toContain("Mesita only. Google was not asked.");
  });

  it("says the catalogue is empty instead of a missed search", () => {
    const html = render({ rows: [], failed: [], notes: [] }, { query: "", variant: "catalogue" });
    expect(html).toContain("Mesita has no places yet. Paste a Google Place ID (ChIJ…) to create the first.");
    expect(html).not.toContain("Nothing on Mesita or Google matches");
  });

  it("leads with whether Mesita holds the place or it is Google only", () => {
    const html = render(OK);
    const on = html.search(/<th[^>]*>\s*On\s*<\/th>/);
    const place = html.search(/<th[^>]*>\s*Place\s*<\/th>/);
    expect(on).toBeGreaterThan(-1);
    expect(place).toBeGreaterThan(on);
    expect(html).toContain(">Mesita</span>");
    expect(html).toContain(">Google only</span>");
    expect(html).toContain("hidden sticky left-0 w-36");
    expect(html).toContain("sm:left-36");
    expect(html).toContain("sm:hidden");
  });

  it("says Mesita for a held place and Google only for one Mesita lacks", () => {
    const held = render({ rows: [HELD], failed: [], notes: [] });
    expect(held).toContain(">Mesita</span>");
    expect(held).not.toContain(">Google only</span>");
    const google = render({ rows: [NEW], failed: [], notes: [] });
    expect(google).toContain(">Google only</span>");
    expect(google).not.toContain(">Mesita</span>");
  });

  it("a word shows Google, not Catalogue or Autocomplete", () => {
    const html = render(OK);
    expect(html).not.toContain("Name Search");
    expect(html).toContain(">Google<");
    expect(html).not.toContain(">Catalogue<");
    expect(html).not.toContain(">Autocomplete<");
    expect(html).not.toContain(">Text Search<");
    expect(html).toContain('scope="row"');
  });

  it("shows each rank, a dash where it missed, both read aloud", () => {
    const missed = row({ key: "k-miss", googleId: null, ranks: { catalogue: 1, autocomplete: null, text: null } });
    const html = render({ rows: [HELD, NEW, missed], failed: [], notes: [] });
    expect(html).toContain(">#2<");
    expect(html).toContain("Google: rank 2");
    expect(html).toContain("Not found by Google");
    expect(html).toContain(">—<");
  });

  it("opens a held place and offers Create on one Mesita lacks, both labelled", () => {
    const html = render(OK);
    expect(html).toContain('href="/manage-single/mesita-a/profile"');
    expect(html).toContain('aria-label="Open Café Nin"');
    expect(html).toContain('aria-label="Enrich Café Nin"');
    expect(html).toContain("visited:text-(--brand-pink-900)");
    expect(html).toContain('aria-label="Create Dos Amores Brunch &amp; Meal on Mesita"');
    expect(html).toContain(">Create<");
    expect(html).not.toContain(">Add<");
  });

  it("links a place Mesita lacks to Google Maps instead of swapping the table", () => {
    const html = render(OK);
    expect(html).toContain(`href="https://www.google.com/maps/place/?q=place_id:${G2}"`);
    expect(html).toContain('aria-label="Dos Amores Brunch &amp; Meal, opens Google Maps in a new tab"');
    expect(html).toContain('target="_blank"');
  });

  it("with Create-on-open on, a Google-only row's name creates and opens it (MESITA-2298)", () => {
    const html = renderToStaticMarkup(
      <FindResults
        query="q"
        result={OK}
        added={new Map()}
        notes={{}}
        disabled={false}
        onOpen={() => {}}
        onOpenGoogle={() => {}}
        onAdd={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Open Dos Amores Brunch &amp; Meal on Mesita"');
    expect(html).not.toContain("opens Google Maps in a new tab");
    // The explicit Create button stays beside it.
    expect(html).toContain('aria-label="Create Dos Amores Brunch &amp; Meal on Mesita"');
  });

  it("draws general state columns, and Found stays off the table", () => {
    const html = render({
      rows: [
        row({
          placeHit: placeHit({
            request_count: 2,
            enriched: true,
            google_stars_overall: 3.8,
            google_review_count: 474,
            google_found: true,
            instagram_found: false,
            facebook_found: true,
            enrich_functions: {
              details: { state: "completed", at: null, detail: null },
              serp: { state: "failed", at: null, detail: null },
              links: { state: "pending", at: null, detail: null },
            },
          }),
          rating: 4.7,
          reviews: 266,
        }),
      ],
      failed: [],
      notes: [],
    });
    expect(html).not.toContain("General States");
    for (const label of [
      "Created",
      "Pulsing",
      "Enriching",
      "Enriched",
      "Selected",
      "Disabled",
    ]) {
      expect(html).toContain(`>${label}<`);
    }
    expect(html).not.toContain(">Reviews<");
    expect(html).not.toContain(">Google Found<");
    expect(html).not.toContain(">Instagram Found<");
    expect(html).not.toContain(">Facebook Found<");
    expect(html).not.toContain("Enrichment Steps");
    expect(html).not.toContain(">Details<");
    expect(html).not.toContain(">Serp<");
    expect(html).not.toContain(">Vectors<");
    expect(html).toContain(">yes<");
    expect(html).toContain(">no<");
    expect(html).not.toContain(">fail<");
    expect(html).not.toContain(">3.8<");
    expect(html).not.toContain(">474<");
    expect(html).not.toContain(">Stars<");
    expect(html).not.toContain(">Count<");
  });

  it("dashes the states Mesita holds on a Google-only row", () => {
    const html = render({ rows: [NEW], failed: [], notes: [] });
    expect(html).not.toContain("Google Found: not on Mesita");
    expect(html).not.toContain("Instagram Found: not on Mesita");
    expect(html).not.toContain("Facebook Found: not on Mesita");
    expect(html).toContain("Created: not on Mesita");
    expect(html).not.toContain(">4.7<");
    expect(html).not.toContain(">266<");
  });

  it("says unknown, not 'not on Mesita', when the row is held without a catalogue payload", () => {
    const html = render({ rows: [HELD], failed: [], notes: [] });
    expect(html).toContain('aria-label="Open Café Nin"');
    expect(html).toContain("This payload does not carry that fact");
    expect(html).not.toContain("Created: not on Mesita");
    expect(html).not.toContain("Details: not on Mesita");
  });

  it("a held place offers Enrich, and a Google-only place does not", () => {
    const held = render({ rows: [HELD], failed: [], notes: [] });
    expect(held).toContain('aria-label="Enrich Café Nin"');
    expect(held).not.toContain(">On Mesita<");
    const google = render({ rows: [NEW], failed: [], notes: [] });
    expect(google).toContain(">Create<");
    expect(google).not.toContain('aria-label="Enrich ');
    expect(google).not.toContain(">Open<");
  });

  it("a run already going replaces Enrich with a disabled Enriching control", () => {
    const html = render({
      rows: [row({ placeHit: placeHit({ enriching: true }) })],
      failed: [],
      notes: [],
    });
    expect(html).toContain('aria-label="Enriching Café Nin"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(">Open<");
    expect(html).not.toContain('aria-label="Enrich Café Nin"');
  });

  it("Starting… is the click still in flight", () => {
    const html = render(
      { rows: [row({ placeHit: placeHit({ enriching: false }) })], failed: [], notes: [] },
      { startingIds: new Set(["mesita-a"]) },
    );
    expect(html).toContain('aria-label="Starting Café Nin"');
    expect(html).toContain(">Starting…<");
    expect(html).toContain(">yes<");
  });

  it("an Enrich failure sits under the verbs and the button comes back", () => {
    const html = render(
      { rows: [HELD], failed: [], notes: [] },
      { enrichErrors: { "mesita-a": "Render refused the run" } },
    );
    expect(html).toContain("Render refused the run");
    expect(html).toContain('aria-label="Enrich Café Nin"');
  });

  it("folds the rank into one line for a phone", () => {
    const html = render(OK);
    expect(html).toContain("Google #2");
    expect(html).toContain("Google #1");
  });

  it("treats a row this page created as Mesita's", () => {
    const html = render(OK, { added: new Map([[G2, "mesita-new"]]) });
    expect(html).toContain('href="/manage-single/mesita-new/profile"');
    expect(html).not.toContain(">Create<");
    expect(html).not.toContain(">Google only</span>");
  });

  it("shows a Create in flight, then its outcome, in a live region", () => {
    expect(render(OK, { notes: { [G2]: { state: "running", text: "Creating…" } } })).toContain("Creating…");
    const done = render(OK, { notes: { [G2]: { state: "ok", text: "Created · not enriched" } } });
    expect(done).toContain("Created · not enriched");
    expect(done).toContain('aria-live="polite"');
  });

  it("marks a failed source's column and says why under the table", () => {
    const html = render({
      rows: [row({ ranks: { catalogue: 1, autocomplete: null, text: null } })],
      failed: ["text"],
      notes: [{ tone: "error", text: "Google Text Search failed: quota" }],
    });
    expect(html).toContain('title="Google failed"');
    expect(html).toContain("Google Text Search failed: quota");
  });

  it("pages at 50 rows with Previous · Next", () => {
    const rows = Array.from({ length: 53 }, (_, i) => row({ key: `k${i}`, googleId: `g${i}`, name: `Place ${i}` }));
    const html = render({ rows, failed: [], notes: [] });
    expect(html).toContain(">Place 49<");
    expect(html).not.toContain(">Place 50<");
    expect(html).toContain("1–50 of 53");
    expect(html).toMatch(/<button type="button" disabled=""[^>]*>Previous</);
    expect(html).toMatch(/<button type="button"(?! disabled)[^>]*>Next</);
  });

  it("draws no pager when one page holds every row", () => {
    const rows = Array.from({ length: 50 }, (_, i) => row({ key: `k${i}`, googleId: `g${i}`, name: `Place ${i}` }));
    const html = render({ rows, failed: [], notes: [] });
    expect(html).toContain(">Place 49<");
    expect(html).not.toContain(">Next<");
  });

  it("says nothing matched and points to the Place ID route", () => {
    const html = render({ rows: [], failed: [], notes: [] });
    expect(html).toContain("Nothing on Mesita or Google matches “dos amores”.");
    expect(html).toContain("Paste its Google Place ID (ChIJ…) to look it up directly.");
  });

  it("when every source failed, lists the failures instead of claiming no match", () => {
    const html = render({
      rows: [],
      failed: ["text"],
      notes: [{ tone: "error", text: "Google failed: down" }],
    });
    expect(html).not.toContain("Nothing on Mesita or Google matches");
    expect(html).toContain("Google failed: down");
  });
});
