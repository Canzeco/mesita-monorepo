// The Add place ceremony is the door (MESITA-1813). `/add` stays a redirect.
//
// Pato live, 2026-09-13: search Google; on Mesita add it; if not, create it.
// Create and Add are owner-only. List rows still say Claim. The old wait-state
// ("Mesita adds places to the catalogue") is the failure mode these rules
// catch — a missing CTA compiles, typechecks, and quietly hands managers
// nowhere to go.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canAddPlace, canVerify } from "./active-organization";
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

function walk(dir: string, out: string[] = []): string[] {
  if (!statSync(dir).isDirectory()) return out;
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const PLACES_PAGE = codeOnly(read("app/(shell)/orgs/[orgId]/places/page.tsx"));
const CEREMONY = codeOnly(
  read("app/(shell)/orgs/[orgId]/places/new/page.tsx"),
);
const ADD_PLACE_SRC = walk(
  path.join(SRC, "components", "add-place"),
).map((f) => readFileSync(f, "utf8"));

describe("the add door is the ceremony", () => {
  it("the places screen links nowhere near /add", () => {
    expect(PLACES_PAGE).not.toContain('"/add"');
    expect(PLACES_PAGE).not.toContain("Add a place");
  });

  it("an empty catalogue offers Add place to the owner, never a wait-state", () => {
    const emptyState =
      PLACES_PAGE.match(/<EmptyState[\s\S]*?^\s*\/>/m)?.[0] ?? "";
    expect(emptyState).not.toBe("");
    expect(emptyState).toContain("orgPlacesNewHref(");
    expect(emptyState).toContain("Add place");
    expect(emptyState).not.toMatch(/Mesita adds places/i);
    expect(PLACES_PAGE).not.toMatch(/Add a place|Create place|New place/i);
    expect(PLACES_PAGE).not.toMatch(/Claim a place|Claim places/i);
  });

  it("an empty catalogue outranks the filter", () => {
    const emptyState =
      PLACES_PAGE.match(/<EmptyState[\s\S]*?^\s*\/>/m)?.[0] ?? "";
    expect(emptyState).not.toBe("");
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

  it("a viewer does not get the Add place CTA", () => {
    expect(PLACES_PAGE).toContain("canAddPlace(org.myRole)");
    expect(canAddPlace("owner")).toBe(true);
    expect(canAddPlace("editor")).toBe(false);
    expect(canAddPlace("viewer")).toBe(false);
  });

  it("search stayed gone — the page filters by rail, never by query", () => {
    expect(PLACES_PAGE).not.toContain("Clear the search");
    expect(PLACES_PAGE).not.toContain("Search by name");
    expect(PLACES_PAGE).not.toContain("<form");
    expect(PLACES_PAGE).not.toMatch(/apiListConsolePlaces\([\s\S]*?query:/);
  });

  it("/add renders a redirect and reads no data", () => {
    const page = read("app/add/page.tsx");
    expect(page).toContain('redirect("/")');
    const code = codeOnly(page);
    expect(code).not.toContain("createServerSupabase");
    expect(code).not.toContain("getPlaceOverview");
    expect(code).not.toContain("CreatePlaceForm");
  });

  it("a bare redirect is not behind the signed-out wall", () => {
    expect(PROTECTED_PREFIXES).not.toContain("/add");
    expect(PROTECTED_PREFIXES).toContain("/places");
  });

  it("the ceremony searches, then Create or Add — never a claim table, never OTP", () => {
    expect(CEREMONY).toContain("Add place");
    expect(CEREMONY).toContain("AddPlaceForm");
    expect(CEREMONY).toContain("canAddPlace");
    expect(CEREMONY).not.toContain('"/add"');
    expect(CEREMONY).not.toContain("apiListConsolePlaces");
    expect(CEREMONY).not.toContain("PlaceHoldButton");
    expect(CEREMONY).not.toContain("MethodsPicker");
    expect(CEREMONY).not.toContain("CreatePlaceForm");
  });

  // MESITA-1850. The boundary is SEARCH-shaped: one full-width bar and the
  // line under it. It drew a 520px column with a field and a button — the
  // shape of the screen this replaced — so every load ended in a shift on
  // swap. And it draws NO result rows: an empty search has none, and
  // promising a list before a query exists is a second lie.
  it("the loading boundary is the search bar, full width, with no rows", () => {
    const loading = read("app/(shell)/orgs/[orgId]/places/new/loading.tsx");
    expect(loading).not.toContain("max-w-md");
    expect(loading).toContain("w-full");
    expect(loading).toContain("h-14");
    expect(loading).not.toContain("length: 5");
    expect(loading).not.toContain("rounded-full");
  });

  it("add-place modules never remount the OTP stack", () => {
    expect(ADD_PLACE_SRC.length).toBeGreaterThan(0);
    const joined = ADD_PLACE_SRC.map(codeOnly).join("\n");
    expect(joined).not.toContain("MethodsPicker");
    expect(joined).not.toMatch(/from\s+["']@\/app\/add/);
    expect(joined).not.toContain("shadow-elev");
    expect(joined).not.toContain("pink-gradient");
    expect(joined).not.toContain("rounded-[26px]");
    expect(joined).not.toContain("rounded-[22px]");
  });

  it("create-then-claim treats a 409 as re-lookup, never as Add", () => {
    const actions = codeOnly(read("app/(shell)/actions/places.ts"));
    expect(actions).toContain("alreadyExists");
    expect(actions).toContain("place_already_exists");
    expect(actions).toContain("retryPlaceId");
    expect(actions).toContain("createThenClaimAction");
    expect(actions).toContain("addListedPlaceAction");
  });

  it("ceremony mutations refuse non-owners before mint or claim", () => {
    const actions = codeOnly(read("app/(shell)/actions/places.ts"));
    expect(actions).toContain("function requireCeremonyOwner");
    expect(actions).toContain("canAddPlace(org.myRole)");
    const createFn = actions.slice(
      actions.indexOf("export async function createThenClaimAction"),
    );
    expect(createFn.indexOf("requireCeremonyOwner")).toBeGreaterThanOrEqual(0);
    expect(createFn.indexOf("requireCeremonyOwner")).toBeLessThan(
      createFn.indexOf("apiCreatePlace"),
    );
    const addFn = actions.slice(
      actions.indexOf("export async function addListedPlaceAction"),
    );
    expect(addFn.indexOf("requireCeremonyOwner")).toBeGreaterThanOrEqual(0);
    expect(addFn.indexOf("requireCeremonyOwner")).toBeLessThan(
      addFn.indexOf("apiClaimPlace"),
    );
  });

  // MESITA-1850. The card became a ROW, and the error with it: a half-done
  // mint (place created, claim failed) must leave its message ON that row and
  // re-ask the catalogue, so the operator's next click acts on what is true
  // NOW. The rewrite keeps both halves and adds the thing the card could not
  // do — errors keyed by place id, so one failing row never wipes another's.
  it("a failed claim after mint keeps the error on its own row, and re-asks", () => {
    const form = codeOnly(read("components/add-place/AddPlaceForm.tsx"));
    expect(form).toContain("retryPlaceId");
    expect(form).toContain("alreadyExists");
    // Per-row, never a single shared slot: two rows can fail independently.
    expect(form).toContain("const [rowErrors, setRowErrors]");
    expect(form).toContain("fail(p.placeId,");
    // The refresh is what makes the next click honest.
    expect(form).toContain("await refresh(p.placeId)");
    const create = form.slice(form.indexOf("const onCreate ="));
    const createBody = create.slice(0, create.indexOf("const onClaim ="));
    expect(createBody.indexOf("refresh(p.placeId)")).toBeGreaterThan(-1);
  });

  // MESITA-1850. Pato: "display if the place is already on mesita or if its
  // not, and put the shitty button to claim/verify all the fucking workflow."
  it("every result row shows its Mesita state and carries its own verb", () => {
    const form = codeOnly(read("components/add-place/AddPlaceForm.tsx"));
    const row = codeOnly(read("components/add-place/AddPlaceRow.tsx"));
    // The state is resolved for EVERY prediction, not for one picked slot.
    expect(form).toContain("for (const p of results)");
    expect(form).toContain("apiLookupPlace(supabase, p.placeId)");
    expect(form).toContain("rowStateForLookup(lookup, held)");
    // A failed lookup leaves the row CHECKING — never "Not on Mesita", which
    // would offer Create for a place that exists and 409 on the click.
    expect(row).toContain("Checking Mesita");
    // The bar is full width and unlabelled: no form column, no Cancel.
    expect(form).not.toContain("FORM_COLUMN_CLASS");
    expect(form).not.toContain("cancelHref");
    expect(form).toContain('type="search"');
    // The verbs live on the row, one per state.
    expect(row).toContain('"Creating…" : "Create"');
    expect(row).toContain('"Claiming…" : "Claim"');
    expect(row).toContain(">\n                Open\n              </Link>");
    expect(row).toContain('state.kind === "create"');
    expect(row).toContain('state.kind === "claim"');
    // A held place gets NO verb — state only.
    expect(row).not.toContain('state.kind === "taken"');
  });
});

describe("verify is offered only where it can work", () => {
  it("is owner-only, matching the Edge Function's own guard", () => {
    expect(canVerify("owner")).toBe(true);
    expect(canVerify("editor")).toBe(false);
    expect(canVerify("viewer")).toBe(false);
  });

  it("renders only on a held, not-yet-verified row", () => {
    expect(PLACES_PAGE).toContain(
      "place.owned === true && place.verified !== true",
    );
    expect(PLACES_PAGE).toContain("PlaceVerifyButton");
  });
});
