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
} from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";

const names = { placeName: "Strana Del Valle" };
const unnamed = { placeName: null };

describe("crumbsFor", () => {
  it("Account, the catalogue and its ceremony stand alone", () => {
    // None of the three is about ONE place, so none of them borrows its name.
    expect(crumbsFor(SHELL_ROUTES.settings, names)).toEqual(["Settings"]);
    expect(crumbsFor(SHELL_ROUTES.places, names)).toEqual(["Places"]);
    expect(crumbsFor(SHELL_ROUTES.placesNew, names)).toEqual(["Places", "Add"]);
  });

  it("Terminal's address names nothing, because Terminal is gone", () => {
    // `/places/<id>/products/terminal` was the ONE sub-step that was not a
    // PAGE: `placePageFromPathname` answered null so the Products ROW would
    // not light there (MESITA-1885), which left it matching nothing here and
    // returning `[]` — a header with no crumbs, reading as a page outside the
    // console. It got the ceremony shape instead.
    //
    // MESITA-1900 retires the product, so the special case is deleted and the
    // address is an unknown segment again. This pins that it names the PLACE
    // and stops — never the word Terminal, which would mean the label
    // outlived the product.
    expect(crumbsFor("/places/p/products/terminal", names)).not.toContain(
      "Terminal",
    );
  });

  it("Online Payments is the one step inside Products", () => {
    // It reads as its PAGE (the Products row stays lit) and still names
    // itself, which is the pair the rail and the header have to agree on.
    // PAY'S SETUP IS A SUB-STEP OF THE PAYMENTS VIEW NOW (MESITA-1974), so
    // the trail names the place and the product and nothing between them —
    // there is no catalogue row above it to name.
    expect(crumbsFor(placePayHref("p"), names)).toEqual([
      "Strana Del Valle",
      "Online Payments",
    ]);
  });

  it("each place page is the place, then the page", () => {
    // Members has no crumb because it has no address (MESITA-1847): the
    // people are content ON Settings, not a page under it.
    expect(crumbsFor(placePageHref("p", "setup"), names)).toEqual([
      "Strana Del Valle",
      "Setup",
    ]);
    expect(crumbsFor(SHELL_ROUTES.settings, names)).toEqual(["Settings"]);
    expect(crumbsFor(placePageHref("p", "activity"), names)).toEqual([
      "Strana Del Valle",
      "Activity",
    ]);
    // …and with no name resolved yet, the noun rather than an empty trail.
    expect(crumbsFor(placePageHref("p", "setup"), unnamed)).toEqual([
      "Place",
      "Setup",
    ]);
  });

  // CUSTOMERS IS ONE THING AGAIN (MESITA-1974), so the two-table check it
  // needed is gone with its page. It was a page AND a product, the crumb read
  // `PLACE_PAGE_LABEL` and the card read `PRODUCT_LABEL`, and this line was
  // all that stopped one of them being renamed alone. It is a product with a
  // row in Setup and no address, so only `PRODUCT_LABEL` names it now.

  it("a place view is the place, then the view", () => {
    expect(crumbsFor(placeTabHref("p", "credits"), names)).toEqual([
      "Strana Del Valle",
      "Prepaid Credits",
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
    expect(crumbsFor("/settings", names)).toEqual(["Settings"]);
    // With nothing resolved the flat address names the page alone: there is
    // no place to borrow, and "Place" would be inventing one.
    expect(crumbsFor("/setup", unnamed)).toEqual(["Setup"]);
  });

  it("the root and unknown paths carry no trail", () => {
    expect(crumbsFor("/", names)).toEqual([]);
    expect(crumbsFor("/nowhere", names)).toEqual([]);
  });
});
