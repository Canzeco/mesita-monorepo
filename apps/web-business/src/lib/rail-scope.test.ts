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
    const s = scope(placeTabHref("p-3", "activity"), { rememberedOrgId: "org-a" });
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
    expect(scope(orgHref("org-b", "payments")).org?.id).toBe("org-b");
    expect(scope(orgPlacesNewHref("org-c")).org?.id).toBe("org-c");
  });

  it("shows the last place opened this session, when this organization holds it", () => {
    const s = scope(orgHref("org-a", "payments"), {
      lastPlaceId: "p-2",
      rememberedPlaceId: "p-1",
    });
    expect(s.place?.id).toBe("p-2");
    expect(s.placeIsCurrent).toBe(false);
  });

  it("falls to the cookie, then the first place, then none", () => {
    expect(scope(orgHref("org-a"), { rememberedPlaceId: "p-2" }).place?.id).toBe("p-2");
    expect(scope(orgHref("org-a")).place?.id).toBe("p-1");
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
