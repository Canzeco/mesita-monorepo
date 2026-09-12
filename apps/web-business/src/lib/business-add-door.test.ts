// The business console does not add places (MESITA-1664).
//
// Pato, 2026-09-08: "for the moment don't enable managers to add places from
// the business app. Only admins can add places... businesses can only
// claim/verify them and own them."
//
// Every rule here guards a door that is closed by ABSENCE — a missing link, a
// missing CTA, a route that only redirects. Absence is the failure mode no
// compiler and no rendering test catches: re-adding the button compiles, type
// checks, renders, and quietly hands managers back a power that was taken away
// on purpose. These are the assertions that notice.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canVerify } from "./active-organization";
import { PROTECTED_PREFIXES } from "./supabase/middleware";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

/** Comments explain WHY a door is shut and therefore quote the very strings
 *  these rules forbid. Scanning them would make an honest explanation
 *  indistinguishable from a regression, so the rules read code only. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
}

const PLACES_PAGE = codeOnly(read("app/(shell)/places/page.tsx"));

describe("the add door is shut", () => {
  it("the places screen links nowhere near /add", () => {
    expect(PLACES_PAGE).not.toContain('"/add"');
    expect(PLACES_PAGE).not.toContain("Add a place");
  });

  it("the empty state can only navigate the list — it can never create", () => {
    // This used to ban the `action` prop outright, which was exact while the
    // empty state had nothing to offer. The rail's filters gave it something
    // (MESITA-1710): on `?owned=org` with a full pool, "No places yet" is a
    // lie, so that state has to say it was the filter and hand back the way
    // out. Banning the MECHANISM would have stopped that honest fix while
    // still passing a page that put "Add a place" in `description`.
    //
    // So the rule guards the DOOR instead of the prop: whatever the empty
    // state offers, it may only point back into the list.
    const emptyState =
      PLACES_PAGE.match(/<EmptyState[\s\S]*?^\s*\/>/m)?.[0] ?? "";
    expect(emptyState).not.toBe("");
    for (const href of emptyState.match(/href=\{[^}]*\}/g) ?? []) {
      expect(href).toMatch(/placesHref\(/);
    }
    // No create verb anywhere on the screen, in any prop.
    // No create verb anywhere on the screen, in any prop. Claim lives on
    // the row (`PlaceHoldButton`), never as a page-level CTA (MESITA-1793).
    expect(PLACES_PAGE).not.toMatch(/Add a place|Create place|New place/i);
    expect(PLACES_PAGE).not.toMatch(/Claim a place|Claim places/i);
  });

  it("an empty catalogue outranks the filter", () => {
    // Live state today is 0 places, so this is the branch a person actually
    // sees. Keying off `owned` first answers "Nothing left to claim — every
    // place in the catalogue is already held" on `?owned=public` when the
    // catalogue holds nothing at all: a filter taking credit for an absence
    // it did not cause. And an empty catalogue gets NO action — there is
    // nowhere to send anyone (MESITA-1664).
    const emptyState =
      PLACES_PAGE.match(/<EmptyState[\s\S]*?^\s*\/>/m)?.[0] ?? "";
    expect(emptyState).not.toBe("");
    expect(emptyState).toContain("places.length === 0 ? null");
    for (const prop of ["title", "description", "action"]) {
      const branch = emptyState.slice(emptyState.indexOf(`${prop}={`));
      expect(branch.indexOf("places.length === 0")).toBeGreaterThanOrEqual(0);
      expect(branch.indexOf("places.length === 0")).toBeLessThan(
        branch.indexOf("owned ===") === -1
          ? Infinity
          : branch.indexOf("owned ==="),
      );
    }
  });

  it("search stayed gone — the page filters by rail, never by query", () => {
    // Search left the page entirely (Pato, 2026-09-09): the console loads
    // every place and sorts client-side instead of filtering server-side.
    // The rail's `?owned=` filters are a VIEW of rows already in hand, not a
    // reason to put the server round trip back.
    expect(PLACES_PAGE).not.toContain("Clear the search");
    expect(PLACES_PAGE).not.toContain("Search by name");
    expect(PLACES_PAGE).not.toContain("<form");
    expect(PLACES_PAGE).not.toMatch(/apiListConsolePlaces\([\s\S]*?query:/);
  });

  it("NoOrganization sends you to the ceremony, not the collection", () => {
    const src = read("components/console/NoOrganization.tsx");
    expect(src).toContain("SHELL_ROUTES.organizationNew");
    expect(src).not.toContain("SHELL_ROUTES.organization}");
  });

  it("/add renders a redirect and reads no data", () => {
    const page = read("app/add/page.tsx");
    expect(page).toContain('redirect("/places")');
    // A redirect that first awaits a session or an EF is a page pretending to
    // be a route. It would reintroduce the load it exists to remove.
    const code = codeOnly(page);
    expect(code).not.toContain("createServerSupabase");
    expect(code).not.toContain("getPlaceOverview");
    expect(code).not.toContain("CreatePlaceForm");
  });

  it("a bare redirect is not behind the signed-out wall", () => {
    expect(PROTECTED_PREFIXES).not.toContain("/add");
    // The wall still stands where it means something.
    expect(PROTECTED_PREFIXES).toContain("/places");
  });
});

describe("verify is offered only where it can work", () => {
  it("is owner-only, matching the Edge Function's own guard", () => {
    expect(canVerify("owner")).toBe(true);
    expect(canVerify("editor")).toBe(false);
    expect(canVerify("viewer")).toBe(false);
  });

  it("renders only on a held, not-yet-verified row", () => {
    // Owned and Verified are independent facts, so the row reads BOTH. An
    // undefined `verified` (the deploy window, where a new row meets an old
    // EF) must show no control rather than a wrong one, which is why the
    // check is `!== true` and not a falsy test.
    expect(PLACES_PAGE).toContain(
      "place.owned === true && place.verified !== true",
    );
    expect(PLACES_PAGE).toContain("PlaceVerifyButton");
  });
});
