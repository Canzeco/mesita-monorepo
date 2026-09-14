// The header's trail mirrors the rail's nesting (MESITA-1807): the
// organization, then its page — or the place, then its view.
import { describe, expect, it } from "vitest";
import { crumbsFor } from "./ConsoleHeader";
import {
  orgHref,
  orgPlacesNewHref,
  placeHref,
} from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";

const names = { orgName: "Strana Group", placeName: "Strana Del Valle" };

describe("crumbsFor", () => {
  it("Account and the ceremony stand alone", () => {
    expect(crumbsFor("/account", names)).toEqual(["Account"]);
    expect(crumbsFor("/orgs/new", names)).toEqual(["Create organization"]);
  });

  it("each organization page is the organization, then the page (MESITA-1842)", () => {
    // Members has no crumb because it has no address (MESITA-1847): the
    // people are content ON the Organization page, not a page under it.
    expect(crumbsFor(orgHref("o", "payments"), names)).toEqual([
      "Strana Group",
      "Payments",
    ]);
    expect(crumbsFor(orgHref("o", "places"), names)).toEqual([
      "Strana Group",
      "Places",
    ]);
    expect(crumbsFor(orgHref("o"), names)).toEqual(["Strana Group"]);
    // …and with no name resolved yet, the noun rather than an empty trail.
    expect(crumbsFor(orgHref("o"), { orgName: null, placeName: null })).toEqual([
      "Organization",
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
    expect(crumbsFor(placeTabHref("p", "capabilities"), names)).toEqual([
      "Strana Group",
      "Strana Del Valle",
      "Capabilities",
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
