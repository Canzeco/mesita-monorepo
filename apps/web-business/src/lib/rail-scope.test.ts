// The rail's scope, over the whole grid (MESITA-1807).
//
// The pathname names the place; these rules only fill in what it does not
// say. Every branch below is a row an operator can actually reach, and the one
// that bit during review is the one this file exists for: the last place
// opened THIS SESSION beats the cookie the layout read at load.
//
// ONE SUBJECT (MESITA-1892). Half of this file used to be about the other one
// — which organization the rail was showing, and the rule that a place
// remembered in org A must not appear under org B. The layer is gone: the
// portfolio is a flat list of places, so `findHolder` has nothing to search
// across and the cross-organization cases it protected cannot arise.
import { describe, expect, it } from "vitest";
import { resolveRailScope, type RailPlace } from "./rail-scope";
import { SHELL_ROUTES, placeHref, placePageHref } from "./console-routes";
import { placeTabHref } from "./place-tabs";

const P1: RailPlace = {
  id: "p-1",
  name: "Strana Del Valle",
  photoUrl: null,
  myRole: "owner",
};
const P2: RailPlace = {
  id: "p-2",
  name: "Strana Polanco",
  photoUrl: null,
  myRole: "editor",
};
const P3: RailPlace = {
  id: "p-3",
  name: "Casa Tres",
  photoUrl: null,
  myRole: "viewer",
};
const MANY = [P1, P2, P3];
const SOLO = [P3];

const scope = (
  pathname: string,
  over: Partial<Parameters<typeof resolveRailScope>[0]> = {},
) => resolveRailScope({ places: MANY, pathname, ...over });

const solo = (
  pathname: string,
  over: Partial<Parameters<typeof resolveRailScope>[0]> = {},
) => resolveRailScope({ places: SOLO, pathname, ...over });

describe("an address that names a place", () => {
  it("is scoped to it, whatever was remembered", () => {
    const s = scope(placeTabHref("p-3", "visits"), { rememberedPlaceId: "p-1" });
    expect(s.place?.id).toBe("p-3");
    expect(s.placeIsCurrent).toBe(true);
    expect(s.foreignPlaceId).toBeNull();
  });

  it("a place I hold no membership on is foreign: the pool, or a 404 in flight", () => {
    const s = scope(placeHref("p-x"), { rememberedPlaceId: "p-1" });
    expect(s.place).toBeNull();
    expect(s.placeIsCurrent).toBe(false);
    expect(s.foreignPlaceId).toBe("p-x");
  });

  it("reads the place off a PAGE address too, however deep (MESITA-1892)", () => {
    // Settings, Products, Customers and Activity were the organization's and
    // are the place's now, and `products/pay` is three segments deep — which
    // is the one screen Stripe returns to. A reader that stopped at two would
    // drop the rail's scope exactly there.
    expect(scope(SHELL_ROUTES.settings).place?.id).toBe("p-2");
    expect(scope("/places/p-2/products/pay").place?.id).toBe("p-2");
    expect(scope("/places/p-2").place?.id).toBe("p-2");
  });
});

describe("every other route", () => {
  it("Account and the catalogue fall back to what the operator was last in", () => {
    expect(scope(SHELL_ROUTES.settings, { rememberedPlaceId: "p-3" }).place?.id).toBe(
      "p-3",
    );
    expect(scope(SHELL_ROUTES.places, { lastPlaceId: "p-2" }).place?.id).toBe("p-2");
    // The catalogue names no place, so it must not have one PICKED for it
    // when nothing was remembered — the multi rule, below.
    expect(scope(SHELL_ROUTES.places).place).toBeNull();
    expect(solo(SHELL_ROUTES.places).place?.id).toBe("p-3");
  });

  it("with no places there is no scope at all", () => {
    const s = resolveRailScope({ places: [], pathname: SHELL_ROUTES.settings });
    expect(s.place).toBeNull();
    expect(s.foreignPlaceId).toBeNull();
    expect(s.mode).toBe("zero");
  });

  it("a remembered place I no longer hold resolves like nothing was named", () => {
    // Released, or removed from the team. The rail falls back rather than
    // naming a place the caller cannot open.
    expect(solo(SHELL_ROUTES.settings, { rememberedPlaceId: "gone" }).place?.id).toBe(
      "p-3",
    );
  });
});

// ── THE FOUR SHAPES (MESITA-1879) ─────────────────────────────────────────
//
// `mode` is the one discriminant the flat rail switches on. It is four values
// and not a boolean because a boolean would answer false to "is this a
// one-place console?" for a caller with none, for one with three, and for a
// read that simply FAILED — three different screens, and the last one is a
// screen that must not print a count at all.
describe("the console's shape", () => {
  it("is solo at exactly one place, and not at zero or two", () => {
    expect(solo(SHELL_ROUTES.settings).mode).toBe("solo");
    expect(
      resolveRailScope({ places: [], pathname: SHELL_ROUTES.settings }).mode,
    ).toBe("zero");
    expect(scope(SHELL_ROUTES.settings).mode).toBe("multi");
  });

  it("is unknown when the READ failed, whatever the array says", () => {
    // `viewerError` is the layout's own flag. An empty array is a successful
    // read of nothing and stays "zero"; the failure outranks the count, and
    // must never be reported as "multi" — the state that tells an operator
    // they hold places they may not hold.
    expect(scope(SHELL_ROUTES.settings, { viewerError: true }).mode).toBe("unknown");
    expect(
      resolveRailScope({
        places: [],
        pathname: "/settings",
        viewerError: true,
      }).mode,
    ).toBe("unknown");
    expect(
      resolveRailScope({
        places: [],
        pathname: SHELL_ROUTES.settings,
        viewerError: false,
      }).mode,
    ).toBe("zero");
  });

  it("never picks a place for a caller who holds several", () => {
    // THE BUG THIS EXISTS FOR. `pickPlace` falls through to `places[0]`, so a
    // flat name — the one address that names no place at all — used to select
    // a venue the operator never chose. On Profile that is an edit against the
    // wrong record, with nothing on screen saying so.
    const s = scope("/profile");
    expect(s.mode).toBe("multi");
    expect(s.place).toBeNull();
    expect(s.placeIsCurrent).toBe(false);
    // Same rule on a flat PAGE, which also names no place.
    expect(scope("/products").place).toBeNull();
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

  it("the SESSION beats the cookie", () => {
    // A shared layout does not re-run on client navigations, so the cookie is
    // right on the first frame only; `OpenPlaceProvider` is the session's own
    // memory and wins on every frame after it.
    expect(
      scope("/profile", { lastPlaceId: "p-2", rememberedPlaceId: "p-1" }).place?.id,
    ).toBe("p-2");
  });

  it("still resolves the ONE place without being asked twice", () => {
    // A solo caller has no ambiguity to protect against, so the single place
    // is still selected with no cookie and no session at all.
    const s = solo("/activity");
    expect(s.mode).toBe("solo");
    expect(s.place?.id).toBe("p-3");
    // Not `placeIsCurrent`: a flat PAGE names no place, so the rail shows one
    // without claiming the operator is standing on it — which is what stops
    // AppShell writing the rail cookie for a place nobody visited.
    expect(s.placeIsCurrent).toBe(false);
    expect(solo(placeTabHref("p-3", "profile")).placeIsCurrent).toBe(true);
  });

  it("keeps the ceremony reachable from the zero shape", () => {
    // Zero places is the console's first-run shape, not an error: the rail
    // keeps Add place and Account, and `/places/new` is still an address.
    const s = resolveRailScope({ places: [], pathname: SHELL_ROUTES.placesNew });
    expect(s.mode).toBe("zero");
    expect(s.place).toBeNull();
    expect(s.foreignPlaceId).toBeNull();
  });
});
