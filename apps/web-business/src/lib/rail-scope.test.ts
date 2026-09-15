// The rail's scope, over the whole grid (MESITA-1807).
//
// The pathname names the organization or the place; these rules only fill in
// what it does not say. Every branch below is a row an operator can actually
// reach, and the two that bit during review are the ones this file exists
// for: a place remembered in org A must not be shown under org B, and the
// last place opened THIS SESSION beats the cookie the layout read at load.
import { describe, expect, it } from "vitest";
import { resolveRailScope, type RailOrg } from "./rail-scope";
import { orgHref, orgPlacesNewHref, placeHref } from "./console-routes";
import { placeTabHref } from "./place-tabs";

const A: RailOrg = {
  id: "org-a",
  name: "Strana Group",
  myRole: "owner",
  places: [
    { id: "p-1", name: "Strana Del Valle", photoUrl: null },
    { id: "p-2", name: "Strana Polanco", photoUrl: null },
  ],
};
const B: RailOrg = { id: "org-b", name: "Org Test", myRole: "editor", places: [] };
const C: RailOrg = {
  id: "org-c",
  name: "Third",
  myRole: "viewer",
  places: [{ id: "p-3", name: "Casa Tres", photoUrl: null }],
};
const ORGS = [A, B, C];

const scope = (pathname: string, over: Partial<Parameters<typeof resolveRailScope>[0]> = {}) =>
  resolveRailScope({ organizations: ORGS, pathname, ...over });

describe("a place route", () => {
  it("is scoped to its holder, whatever organization was remembered", () => {
    const s = scope(placeTabHref("p-3", "visits"), { rememberedOrgId: "org-a" });
    expect(s.org?.id).toBe("org-c");
    expect(s.place?.id).toBe("p-3");
    expect(s.placeIsCurrent).toBe(true);
    expect(s.foreignPlaceId).toBeNull();
  });

  it("a place in no organization of mine is foreign: the pool, or a 404 in flight", () => {
    const s = scope(placeHref("p-x"), { rememberedOrgId: "org-b" });
    expect(s.org?.id).toBe("org-b");
    expect(s.place).toBeNull();
    expect(s.placeIsCurrent).toBe(false);
    expect(s.foreignPlaceId).toBe("p-x");
  });

  it("a foreign place with nothing remembered falls back to the first organization", () => {
    expect(scope(placeHref("p-x")).org?.id).toBe("org-a");
  });
});

describe("an organization route", () => {
  it("is scoped to the path's organization", () => {
    expect(scope(orgHref("org-b", "places")).org?.id).toBe("org-b");
    expect(scope(orgPlacesNewHref("org-c")).org?.id).toBe("org-c");
  });

  it("shows the last place opened this session, when this organization holds it", () => {
    const s = scope(orgHref("org-a"), {
      lastPlaceId: "p-2",
      rememberedPlaceId: "p-1",
    });
    expect(s.place?.id).toBe("p-2");
    expect(s.placeIsCurrent).toBe(false);
  });

  it("falls to the cookie, then to NOTHING when the choice is not the rail's", () => {
    // AMENDED BY MESITA-1879, and the middle line is the whole amendment.
    // It used to read `.place?.id).toBe("p-1")` — org-a holds two places, so
    // with no cookie and no session the rail picked `places[0]` and showed a
    // venue the operator never chose. That assertion was the bug written down
    // as a requirement.
    //
    // A remembered place is still a CHOICE and still wins. What is gone is
    // the guess after it.
    expect(scope(orgHref("org-a"), { rememberedPlaceId: "p-2" }).place?.id).toBe("p-2");
    expect(scope(orgHref("org-a")).place).toBeNull();
    // A solo organization has nothing to guess between, so its one place is
    // still resolved with no cookie at all — the rule narrows, it does not
    // stop resolving.
    expect(scope(orgHref("org-c")).place?.id).toBe("p-3");
    expect(scope(orgHref("org-b"), { lastPlaceId: "p-1", rememberedPlaceId: "p-1" }).place).toBeNull();
  });

  it("never shows another organization's place under this one", () => {
    // p-1 is org-a's. Remembered or last-opened, it is not org-c's to show.
    const s = scope(orgHref("org-c"), { lastPlaceId: "p-1", rememberedPlaceId: "p-1" });
    expect(s.place?.id).toBe("p-3");
  });

  it("a path organization I am not in resolves like nothing was named", () => {
    // The org layout answers 404 for it; the rail beside the 404 falls back
    // rather than naming an organization the caller cannot see.
    const s = scope(orgHref("someone-elses"), { rememberedOrgId: "org-b" });
    expect(s.org?.id).toBe("org-b");
  });
});

describe("every other route", () => {
  it("Account and the ceremony fall back to the remembered organization, else the first", () => {
    expect(scope("/account", { rememberedOrgId: "org-c" }).org?.id).toBe("org-c");
    expect(scope("/orgs/new").org?.id).toBe("org-a");
    expect(scope("/account", { rememberedOrgId: "gone" }).org?.id).toBe("org-a");
  });

  it("with no organizations there is no scope at all", () => {
    const s = resolveRailScope({ organizations: [], pathname: "/account" });
    expect(s.org).toBeNull();
    expect(s.place).toBeNull();
    expect(s.foreignPlaceId).toBeNull();
  });
});

// ── THE FOUR SHAPES (MESITA-1879) ─────────────────────────────────────────
//
// `mode` is the one discriminant the flat rail switches on. It is four values
// and not a boolean because a boolean would answer false to "is this a
// one-place console?" for an organization with none, for one with three, and
// for a read that simply FAILED — three different screens, and the last one is
// a screen that must not print a count at all.
describe("the console's shape", () => {
  it("is solo at exactly one place, and not at zero or two", () => {
    // The bijection: the same organization list, read from three addresses,
    // must agree about how many places the SHOWN organization holds.
    expect(scope(orgHref("org-c", "settings")).mode).toBe("solo");
    expect(scope(orgHref("org-b", "settings")).mode).toBe("zero");
    expect(scope(orgHref("org-a", "settings")).mode).toBe("multi");
  });

  it("is unknown when the READ failed, whatever the array says", () => {
    // `viewerError` is the layout's own flag. An empty array is a successful
    // read of nothing and stays "zero"; the failure outranks the count, and
    // must never be reported as "multi" — the state that tells an operator
    // they hold places they may not hold.
    const failed = scope(orgHref("org-a", "settings"), { viewerError: true });
    expect(failed.mode).toBe("unknown");
    expect(scope("/settings", { viewerError: true, organizations: [] }).mode).toBe(
      "unknown",
    );
    expect(scope(orgHref("org-b", "settings"), { viewerError: false }).mode).toBe(
      "zero",
    );
  });

  it("never picks a place for an organization that holds several", () => {
    // THE BUG THIS EXISTS FOR. `pickPlace` falls through to `places[0]`, so a
    // flat name — the one address that names no place at all — used to select
    // a venue the operator never chose. On Profile that is an edit against the
    // wrong record, with nothing on screen saying so.
    const s = scope("/profile");
    expect(s.mode).toBe("multi");
    expect(s.place).toBeNull();
    expect(s.placeIsCurrent).toBe(false);
    // Same rule on an organization route, which also names no place.
    expect(scope(orgHref("org-a", "products")).place).toBeNull();
  });

  it("still shows the place the operator DID choose", () => {
    // The opposite direction, and the reason this is not just "return null":
    // a place opened this session or remembered from the last is a choice.
    // Refusing it would make the rail forget a venue the operator is sitting
    // on, which is the same lie pointed the other way.
    expect(scope("/profile", { lastPlaceId: "p-2" }).place?.id).toBe("p-2");
    expect(scope("/profile", { rememberedPlaceId: "p-1" }).place?.id).toBe("p-1");
    // And the ADDRESS naming one always wins, in every mode.
    const named = scope(placeTabHref("p-2", "profile"));
    expect(named.mode).toBe("multi");
    expect(named.place?.id).toBe("p-2");
    expect(named.placeIsCurrent).toBe(true);
  });

  it("still resolves the ONE place without being asked twice", () => {
    // A solo organization has no ambiguity to protect against, so the single
    // place is still selected with no cookie and no session at all.
    const s = scope(orgHref("org-c", "activity"));
    expect(s.mode).toBe("solo");
    expect(s.place?.id).toBe("p-3");
  });

  it("keeps the ceremony reachable from the zero shape", () => {
    // Zero places is the console's first-run shape, not an error: the
    // organization resolves, the rail keeps Settings and Account, and Add
    // place is still an address.
    const s = scope(orgPlacesNewHref("org-b"));
    expect(s.mode).toBe("zero");
    expect(s.org?.id).toBe("org-b");
    expect(s.place).toBeNull();
  });
});
