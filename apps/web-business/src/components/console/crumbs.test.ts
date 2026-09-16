// The header's trail mirrors the rail's nesting (MESITA-1807): the place,
// then the page or view it is showing.
//
// ONE SUBJECT (MESITA-1892). The trail used to open with the ORGANIZATION and
// name the place under it; there is no organization, so the place is the first
// crumb on every address that has one, and the four pages that used to be the
// organization's sit under it like every view does.
import { describe, expect, it } from "vitest";
import { crumbsFor } from "./ConsoleHeader";
import {
  SHELL_ROUTES,
  placeHref,
  placePageHref,
  placePayHref,
  placeTerminalHref,
} from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";

const names = { placeName: "Strana Del Valle" };
const unnamed = { placeName: null };

describe("crumbsFor", () => {
  it("Account, the catalogue and its ceremony stand alone", () => {
    // None of the three is about ONE place, so none of them borrows its name.
    expect(crumbsFor(SHELL_ROUTES.account, names)).toEqual(["Account"]);
    expect(crumbsFor(SHELL_ROUTES.places, names)).toEqual(["Places"]);
    expect(crumbsFor(SHELL_ROUTES.placesNew, names)).toEqual(["Places", "Add"]);
  });

  it("Terminal is a STEP inside Products, and never an empty trail", () => {
    // `/places/<id>/products/terminal` is deliberately not a PAGE —
    // `placePageFromPathname` answers null so the Products ROW does not light
    // there (MESITA-1885). That made it match nothing here and return `[]`,
    // which renders a header with no crumbs at all: a page that reads as
    // being outside the console.
    expect(crumbsFor(placeTerminalHref("p"), names)).toEqual([
      "Strana Del Valle",
      "Products",
      "Terminal",
    ]);
    // And it names the place even when the scope has not resolved one.
    expect(crumbsFor(placeTerminalHref("p"), unnamed)).toEqual([
      "Place",
      "Products",
      "Terminal",
    ]);
    // THE BIJECTION: the catalogue itself is still two crumbs, so the leaf is
    // a real difference and not a label this test would accept anywhere.
    expect(crumbsFor(placePageHref("p", "products"), names)).not.toContain(
      "Terminal",
    );
  });

  it("Mesita Pay is the other step inside Products", () => {
    // It reads as its PAGE (the Products row stays lit) and still names
    // itself, which is the pair the rail and the header have to agree on.
    expect(crumbsFor(placePayHref("p"), names)).toEqual([
      "Strana Del Valle",
      "Products",
      "Mesita Pay",
    ]);
  });

  it("each place page is the place, then the page", () => {
    // Members has no crumb because it has no address (MESITA-1847): the
    // people are content ON Settings, not a page under it.
    expect(crumbsFor(placePageHref("p", "products"), names)).toEqual([
      "Strana Del Valle",
      "Products",
    ]);
    expect(crumbsFor(placePageHref("p", "settings"), names)).toEqual([
      "Strana Del Valle",
      "Settings",
    ]);
    expect(crumbsFor(placePageHref("p", "activity"), names)).toEqual([
      "Strana Del Valle",
      "Activity",
    ]);
    // …and with no name resolved yet, the noun rather than an empty trail.
    expect(crumbsFor(placePageHref("p", "customers"), unnamed)).toEqual([
      "Place",
      "Customers",
    ]);
  });

  it("a place view is the place, then the view", () => {
    expect(crumbsFor(placeTabHref("p", "credits"), names)).toEqual([
      "Strana Del Valle",
      "Credits",
    ]);
    expect(crumbsFor(placeHref("p"), names)).toEqual([
      "Strana Del Valle",
      "Profile",
    ]);
    expect(crumbsFor(placeHref("p"), { placeName: "Café Nin" })).toEqual([
      "Café Nin",
      "Profile",
    ]);
  });

  it("a flat address borrows the resolved name, view or page", () => {
    // An operator who typed `/profile` is on Profile while the forward is in
    // flight, and a header with no trail for that instant reads as a glitch —
    // the same courtesy the rail's rows get.
    expect(crumbsFor("/profile", names)).toEqual([
      "Strana Del Valle",
      "Profile",
    ]);
    expect(crumbsFor("/settings", names)).toEqual([
      "Strana Del Valle",
      "Settings",
    ]);
    // With nothing resolved the flat address names the page alone: there is
    // no place to borrow, and "Place" would be inventing one.
    expect(crumbsFor("/products", unnamed)).toEqual(["Products"]);
  });

  it("the root and unknown paths carry no trail", () => {
    expect(crumbsFor("/", names)).toEqual([]);
    expect(crumbsFor("/nowhere", names)).toEqual([]);
  });
});
