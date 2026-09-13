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

  it("the ceremony loading boundary is form-shaped, not the list", () => {
    const loading = read("app/(shell)/orgs/[orgId]/places/new/loading.tsx");
    expect(loading).toContain("max-w-md");
    expect(loading).not.toContain("h-[68px]");
    expect(loading).not.toContain("length: 5");
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

  it("a failed claim after mint keeps the error on the Add card", () => {
    const form = codeOnly(read("components/add-place/AddPlaceForm.tsx"));
    const apply = form.slice(form.indexOf("const applyLookup"));
    const applyBody = apply.slice(0, apply.indexOf("const pick"));
    expect(applyBody).not.toContain("setActionError(null)");
    expect(form).toContain("setActionError(result.error)");
    expect(form).toContain("retryPlaceId");
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
