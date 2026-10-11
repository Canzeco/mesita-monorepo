import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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
    ranks: { catalogue: 1, name: 1, autocomplete: 2, text: 1 },
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
  ranks: { catalogue: null, name: null, autocomplete: 1, text: 2 },
});

function render(result: FindResult, over: Partial<Parameters<typeof FindResults>[0]> = {}) {
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
  it("groups the source columns MESITA | GOOGLE, as column groups", () => {
    const html = render(OK);
    expect(html).toMatch(/<th[^>]*colSpan="2"[^>]*scope="colgroup"[^>]*>Mesita<\/th>/i);
    expect(html).toMatch(/<th[^>]*colSpan="2"[^>]*scope="colgroup"[^>]*>Google<\/th>/i);
    for (const label of ["Catalogue", "Name Search", "Autocomplete", "Text Search"]) {
      expect(html).toContain(`>${label}`);
    }
    expect(html).toContain('scope="row"');
  });

  it("shows each source's rank, a dash where it missed, both read aloud", () => {
    const html = render(OK);
    expect(html).toContain(">#2<");
    expect(html).toContain("Google Text Search: rank 2");
    expect(html).toContain("Not found by Mesita catalogue");
    expect(html).toContain(">—<");
  });

  it("opens a held place and offers Add on one Mesita lacks, both labelled", () => {
    const html = render(OK);
    expect(html).toContain('href="/manage-single/mesita-a/profile"');
    expect(html).toContain('aria-label="Open Café Nin"');
    expect(html).toContain('aria-label="Add Dos Amores Brunch &amp; Meal to Mesita"');
    expect(html).toContain(">Add<");
  });

  it("links a place Mesita lacks to Google Maps instead of swapping the table", () => {
    const html = render(OK);
    expect(html).toContain(`href="https://www.google.com/maps/place/?q=place_id:${G2}"`);
    expect(html).toContain('aria-label="Dos Amores Brunch &amp; Meal, opens Google Maps in a new tab"');
    expect(html).toContain('target="_blank"');
  });

  it("shows the Text Search rating and folds the sources into one line for a phone", () => {
    const html = render(OK);
    expect(html).toContain("4.7 · 266 reviews");
    expect(html).toContain("Autocomplete #1 · Text #2");
    expect(html).toContain("Catalogue #1 · Name #1 · Autocomplete #2 · Text #1");
  });

  it("treats a row this page added as Mesita's", () => {
    const html = render(OK, { added: new Map([[G2, "mesita-new"]]) });
    expect(html).toContain('href="/manage-single/mesita-new/profile"');
    expect(html).not.toContain(">Add<");
  });

  it("shows an Add in flight, then its outcome, in a live region", () => {
    expect(render(OK, { notes: { [G2]: { state: "running", text: "Adding…" } } })).toContain("Adding…");
    const done = render(OK, { notes: { [G2]: { state: "ok", text: "Added · enrich queued" } } });
    expect(done).toContain("Added · enrich queued");
    expect(done).toContain('aria-live="polite"');
  });

  it("marks a failed source's column and says why under the table", () => {
    const html = render({
      rows: [row({ ranks: { catalogue: 1, name: 1, autocomplete: null, text: 1 } })],
      failed: ["autocomplete"],
      notes: [{ tone: "error", text: "Google Autocomplete failed: quota" }],
    });
    expect(html).toContain('title="Google Autocomplete failed"');
    expect(html).toContain("Google Autocomplete failed: quota");
  });

  it("draws the first 20 rows and offers the rest", () => {
    const rows = Array.from({ length: 23 }, (_, i) => row({ key: `k${i}`, googleId: `g${i}`, name: `Place ${i}` }));
    const html = render({ rows, failed: [], notes: [] });
    expect(html).toContain("Place 19");
    expect(html).not.toContain("Place 20");
    expect(html).toContain("Show 3 more");
  });

  it("says nothing matched and points to the Place ID route", () => {
    const html = render({ rows: [], failed: [], notes: [] });
    expect(html).toContain("Nothing on Mesita or Google matches “dos amores”.");
    expect(html).toContain("Paste its Google Place ID (ChIJ…) to look it up directly.");
  });

  it("when every source failed, lists the failures instead of claiming no match", () => {
    const html = render({
      rows: [],
      failed: ["catalogue", "name", "autocomplete", "text"],
      notes: [{ tone: "error", text: "Google Text Search failed: down" }],
    });
    expect(html).not.toContain("Nothing on Mesita or Google matches");
    expect(html).toContain("Google Text Search failed: down");
  });
});
