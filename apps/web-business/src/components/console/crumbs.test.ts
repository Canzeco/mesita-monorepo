// The header's trail mirrors the rail's nesting (MESITA-1807): the
// organization, then its page — or the place, then its view.
import { describe, expect, it } from "vitest";
import { crumbsFor } from "./ConsoleHeader";
import { orgHref, orgPlacesNewHref, placeHref } from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";

const names = { orgName: "Strana Group", placeName: "Strana Del Valle" };

describe("crumbsFor", () => {
  it("Account and the ceremony stand alone", () => {
    expect(crumbsFor("/account", names)).toEqual(["Account"]);
    expect(crumbsFor("/orgs/new", names)).toEqual(["Create organization"]);
  });

  it("an organization page is the organization, then the page", () => {
    expect(crumbsFor(orgHref("o"), names)).toEqual(["Strana Group", "Overview"]);
    expect(crumbsFor(orgHref("o", "payments"), names)).toEqual([
      "Strana Group",
      "Payments",
    ]);
    expect(crumbsFor(orgHref("o", "members"), names)).toEqual([
      "Strana Group",
      "Members",
    ]);
    expect(crumbsFor(orgHref("o", "places"), names)).toEqual([
      "Strana Group",
      "Places",
    ]);
  });

  it("the claim ceremony is Places / Claim", () => {
    expect(crumbsFor(orgPlacesNewHref("o"), names)).toEqual([
      "Strana Group",
      "Places",
      "Claim",
    ]);
  });

  it("a place is its holder, the place, then the view", () => {
    expect(crumbsFor(placeTabHref("p", "activity"), names)).toEqual([
      "Strana Group",
      "Strana Del Valle",
      "Activity",
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
