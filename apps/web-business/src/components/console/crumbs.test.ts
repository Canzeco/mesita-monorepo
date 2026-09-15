// The header's trail mirrors the rail's nesting (MESITA-1807): the
// organization, then its page — or the place, then its view.
import { describe, expect, it } from "vitest";
import { crumbsFor } from "./ConsoleHeader";
import {
  orgHref,
  orgPlacesNewHref,
  orgTerminalHref,
  placeHref,
} from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";

const names = { orgName: "Strana Group", placeName: "Strana Del Valle" };

describe("crumbsFor", () => {
  it("Account and the ceremony stand alone", () => {
    expect(crumbsFor("/account", names)).toEqual(["Account"]);
    expect(crumbsFor("/orgs/new", names)).toEqual(["Create organization"]);
  });

  it("Terminal is a STEP inside Products, and never an empty trail", () => {
    // `/orgs/<id>/products/terminal` is deliberately not an org TARGET —
    // `orgTargetFromPathname` answers null so the Products ROW does not light
    // there (MESITA-1885). That made it match nothing here and return `[]`,
    // which renders a header with no crumbs at all: a page that reads as
    // being outside the console.
    //
    // It takes the ceremony shape, the one `/places/new` already uses.
    expect(crumbsFor(orgTerminalHref("o"), names)).toEqual([
      "Strana Group",
      "Products",
      "Terminal",
    ]);
    // And it names the organization even when the scope has not resolved one.
    expect(
      crumbsFor(orgTerminalHref("o"), { orgName: null, placeName: null }),
    ).toEqual(["Organization", "Products", "Terminal"]);
    // THE BIJECTION: the catalogue itself is still two crumbs, so the leaf is
    // a real difference and not a label this test would accept anywhere.
    expect(crumbsFor(orgHref("o", "products"), names)).not.toContain("Terminal");
  });

  it("each organization page is the organization, then the page", () => {
    // Members has no crumb because it has no address (MESITA-1847): the
    // people are content ON Settings, not a page under it. Every address that
    // IS a page gets both crumbs — there is no bare-name target left to
    // special-case since MESITA-1848.
    expect(crumbsFor(orgHref("o", "products"), names)).toEqual([
      "Strana Group",
      "Products",
    ]);
    expect(crumbsFor(orgHref("o", "places"), names)).toEqual([
      "Strana Group",
      "Places",
    ]);
    expect(crumbsFor(orgHref("o"), names)).toEqual(["Strana Group", "Settings"]);
    // …and with no name resolved yet, the noun rather than an empty trail.
    expect(crumbsFor(orgHref("o"), { orgName: null, placeName: null })).toEqual([
      "Organization",
      "Settings",
    ]);
  });

  it("the add ceremony is Places / Add", () => {
    expect(crumbsFor(orgPlacesNewHref("o"), names)).toEqual([
      "Strana Group",
      "Places",
      "Add",
    ]);
  });

  it("a place is its holder, the place, then the view", () => {
    expect(crumbsFor(placeTabHref("p", "credits"), names)).toEqual([
      "Strana Group",
      "Strana Del Valle",
      "Credits",
    ]);
    expect(crumbsFor(placeHref("p"), names)).toEqual([
      "Strana Group",
      "Strana Del Valle",
      "Profile",
    ]);
  });

  it("a pool place with no organization of mine names only the place", () => {
    expect(crumbsFor(placeHref("p"), { orgName: null, placeName: "Café Nin" })).toEqual([
      "Café Nin",
      "Profile",
    ]);
    expect(crumbsFor(placeHref("p"), { orgName: "Org", placeName: null })).toEqual([
      "Org",
      "Place",
      "Profile",
    ]);
  });

  it("the root and unknown paths carry no trail", () => {
    expect(crumbsFor("/", names)).toEqual([]);
    expect(crumbsFor("/nowhere", names)).toEqual([]);
  });
});
