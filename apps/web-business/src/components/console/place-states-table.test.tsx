// The states matrix, RENDERED. Not a source read — the actual HTML.
//
// web-business is email-OTP gated and the production catalogue is empty, so
// nobody — no agent, no preview, no screenshot — can look at this screen.
// renderToStaticMarkup against fixtures is the strongest proof available, and
// org-screen-sections.test.tsx already proves the pattern works here with no
// DOM and no server mocks.
//
// The action cell is INJECTED, which is why this file can exist at all:
// PlaceHoldButton is a client component importing a "use server" module, so a
// table that imported it would drag next/headers into this environment.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlaceStatesTable } from "./PlaceStatesTable";
import type { ConsolePlace } from "@/lib/api/organizations";

function place(over: Partial<ConsolePlace> = {}): ConsolePlace {
  return {
    id: "p1",
    name: "Cabaret Social Room",
    address: null,
    zone: null,
    organizationId: "org-1",
    claimedAt: null,
    organizationName: "Canzeco",
    photoUrl: null,
    listed: true,
    requestCount: 3,
    enriching: false,
    enriched: true,
    businessState: "OPERATIONAL",
    seeded: true,
    owned: true,
    partner: false,
    verified: true,
    ...over,
  };
}

function render(over: Partial<Parameters<typeof PlaceStatesTable>[0]> = {}) {
  return renderToStaticMarkup(
    <PlaceStatesTable
      places={[place()]}
      organizationId="org-1"
      {...over}
    />,
  );
}

describe("rows and columns", () => {
  it("renders one row per place", () => {
    const html = render({
      places: [place({ id: "a", name: "Alpha" }), place({ id: "b", name: "Beta" })],
    });
    expect(html).toContain("Alpha");
    expect(html).toContain("Beta");
    expect((html.match(/<tr/g) ?? []).length).toBe(3); // 1 header row + 2 places
  });

  it("has ONE header row, and no group label over a group of one", () => {
    // MESITA-1651 reverses the line above it. The group row existed because
    // the vocabulary was TWO boxes; MESITA-1637 removed Intake and left a
    // heading that spanned every column and named nothing the column heads
    // already said. Pato, seeing it: "THIS LOOKS LIKE SHIT."
    const html = render();
    expect(html).not.toContain("General States");
    expect(html).not.toContain("Intake States");
    expect(html).not.toContain('scope="colgroup"');
    // Two <tr> in the whole table: one header row, one place.
    expect((html.match(/<tr/g) ?? []).length).toBe(2);
  });

  it("still names all nine states, in Pato's order", () => {
    const html = render();
    const heads = [...html.matchAll(/<th[^>]*>([^<]+)</g)].map((m) => m[1].trim());
    expect(heads).toEqual([
      "Place",
      "Created",
      "Active",
      "Listed",
      "Requested",
      "Enriching",
      "Enriched",
      "Verified",
      "Owned",
      "Partnered",
    ]);
  });

  it("does not spend 1560px spreading nine yes/no cells apart", () => {
    // That width was sized for twenty columns. Nine remain.
    const html = render();
    expect(html).not.toContain("lg:min-w-[1560px]");
    expect(html).toContain("min-w-[1180px]");
  });

  it("the identity cell holds the image and the name and nothing else", () => {
    const html = render({
      places: [place({ organizationName: "Canzeco", address: "Av. Nuevo León 4" })],
    });
    // Both facts are still ON the payload; the cell must not render them.
    expect(html).not.toContain("Canzeco");
    expect(html).not.toContain("Av. Nuevo León 4");
    expect(html).toContain("Cabaret Social Room");
  });
});

describe("cell values", () => {
  it("says yes, no and ? in words", () => {
    const html = render({
      places: [place({ listed: true, partner: false, verified: undefined })],
    });
    expect(html).toContain(">yes<");
    expect(html).toContain(">no<");
    expect(html).toContain(">?<");
  });

  // The deploy window: merging to main auto-deploys the EF and triggers the
  // Vercel build in parallel, so this component briefly runs against a payload
  // that predates it. It must not throw, and it must not invent answers.
  it("renders a payload with every new field absent, without throwing", () => {
    const bare: ConsolePlace = {
      id: "p9",
      name: "Old Payload",
      address: null,
      zone: null,
      organizationId: null,
      claimedAt: null,
    };
    const html = renderToStaticMarkup(
      <PlaceStatesTable places={[bare]} organizationId="org-1" />,
    );
    expect(html).toContain("Old Payload");
    // Nine general columns, none of them answerable.
    expect((html.match(/>\?</g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(html).not.toContain("undefined");
  });

  // Google's silence is a third state. Flattening null to false would assert
  // the business is closed — a claim nobody read (MESITA-1239).
  it("never asserts closed when Google is silent", () => {
    const html = render({ places: [place({ businessState: null })] });
    expect(html).toContain('aria-label="Active: unknown"');
  });

  it("reports a withheld fact as unknown, never as no", () => {
    const html = render({ places: [place({ verified: undefined })] });
    expect(html).toContain('aria-label="Verified: unknown"');
    expect(html).not.toContain('aria-label="Verified: no"');
  });
});

// MESITA-1637. Pato: "the intake states are internal." The block that used to
// live here proved the matrix read the per-function MAP rather than the
// high-water — the right proof while those columns existed. They do not, so
// the proof inverts: nothing about our pipeline may reach this table.
//
// The two general columns that came from intake are NOT intake and must
// survive, so this asserts both directions in one place. Deleting the block
// and asserting nothing is how a rule quietly stops being enforced.
describe("intake is internal and off this table", () => {
  it("renders no Intake group, no function columns, no rung labels", () => {
    const html = render();
    expect(html).not.toContain("Intake States");
    for (const label of ["Seed", "Serp", "Embedding", "Description", "Reviews"]) {
      expect(html).not.toContain(label);
    }
  });

  it("still renders Enriching and Enriched — those are facts about the PLACE", () => {
    // Neither reads intake: Enriching is its own boolean on the row and
    // Enriched is the EF's answer. Losing them with the machinery would be
    // the overshoot this test exists to catch.
    const html = render({ places: [place({ enriching: true, enriched: false })] });
    expect(html).toContain('aria-label="Enriching: yes"');
    expect(html).toContain('aria-label="Enriched: no"');
  });
});

// MESITA-1614 merged Org Places and Public Places. The whole point was that
// Owned stops being constant, so these pin the two things that only become
// true once one list holds both kinds of row.
describe("one list, both kinds of row", () => {
  it("renders held and claimable places side by side, and Owned varies", () => {
    const html = render({
      places: [
        place({ id: "mine", name: "Held Bar", owned: true }),
        place({ id: "free", name: "Free Bar", owned: false, organizationId: null }),
      ],
    });
    expect(html).toContain("Held Bar");
    expect(html).toContain("Free Bar");
    expect(html).toContain('aria-label="Owned: yes"');
    expect(html).toContain('aria-label="Owned: no"');
  });

  // The action follows the FACT, not the screen. This is what used to be two
  // pages with a hardcoded verb each.
  it("gives a held place Release and a claimable one Claim", () => {
    const html = render({
      places: [
        place({ id: "mine", name: "Held Bar", owned: true }),
        place({ id: "free", name: "Free Bar", owned: false }),
      ],
      renderAction: (p) => (
        <button type="button">{p.owned ? "Release" : "Claim"}</button>
      ),
    });
    expect(html).toContain(">Release<");
    expect(html).toContain(">Claim<");
  });

  // Every row comes from one membership-scoped read, so no column is
  // withheld any more — the "?" columns the pool used to force are gone.
  it("answers Partner and Verified on a claimable row too", () => {
    const html = render({
      places: [place({ id: "free", owned: false, partner: false, verified: false })],
    });
    expect(html).toContain('aria-label="Partnered: no"');
    expect(html).toContain('aria-label="Verified: no"');
    expect(html).not.toContain('aria-label="Verified: unknown"');
  });
});

describe("actions", () => {
  it("renders the injected action cell", () => {
    const html = render({
      renderAction: (p) => <button type="button">Claim {p.name}</button>,
    });
    expect(html).toContain("Claim Cabaret Social Room");
  });

  // PlaceHoldButton returns null for a viewer. In a flex row that collapsed
  // cleanly; in a table it would leave a headed, permanently empty column.
  it("collapses the action column when there is no action", () => {
    const html = render({ renderAction: undefined });
    expect(html).not.toContain("Actions");
  });
});
