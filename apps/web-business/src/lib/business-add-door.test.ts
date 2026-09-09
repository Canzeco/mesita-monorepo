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

  it("the empty state offers no action — the search bar is gone, so there is nothing to clear", () => {
    // Search left the page entirely (Pato, 2026-09-09): the console loads
    // every place and sorts client-side instead of filtering server-side.
    // With no query to filter by, the empty state has nothing to hand back
    // and nothing to create — it renders unconditionally, with no `action`
    // prop at all.
    const emptyState = PLACES_PAGE.match(/<EmptyState[\s\S]*?\/>\s*\n/)?.[0] ?? "";
    expect(emptyState).not.toContain("action=");
    expect(PLACES_PAGE).not.toContain("Clear the search");
    expect(PLACES_PAGE).not.toContain("Search by name");
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
    expect(PLACES_PAGE).toContain("place.owned === true && place.verified !== true");
    expect(PLACES_PAGE).toContain("PlaceVerifyButton");
  });
});
