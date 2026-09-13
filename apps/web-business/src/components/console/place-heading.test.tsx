// The place views are reachable from the heading (MESITA-1804).
//
// MESITA-1793 took the view rows out of the rail and nothing else linked to
// the four views — three of them became URL-only and every source-reading
// contract stayed green, because no test asked "who renders a link to each
// view?". This one renders the REAL heading and asks exactly that: every
// member of PLACE_TABS the viewer may open is a link, no more links than
// views, and exactly one of them is the current page. Rendered with
// renderToStaticMarkup and a mocked router so the row is proven as output,
// not as source text.
//
// Retires with the scoped rail (the rail carries the views again); delete
// this file in the same PR that deletes the row.
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PLACE_TABS, PLACE_TAB_LABEL, placeTabHref } from "@/lib/place-tabs";

const nav = vi.hoisted(() => ({ pathname: "/places/p-1/activity", org: "org-1" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.org ? `org=${nav.org}` : ""),
}));

import { PlaceHeading } from "./PlaceHeading";

function render(tabs: readonly (typeof PLACE_TABS)[number][]) {
  return renderToStaticMarkup(
    <PlaceHeading
      name="Strana Del Valle"
      verified
      listed
      partner={false}
      placeId="p-1"
      tabs={tabs}
    />,
  );
}

const links = (html: string) => html.match(/<a\s[^>]*href="[^"]*"/g) ?? [];
const current = (html: string) => html.match(/aria-current="page"/g) ?? [];

afterEach(() => {
  nav.pathname = "/places/p-1/activity";
  nav.org = "org-1";
});

describe("the place views are linked from the heading (MESITA-1804)", () => {
  it("every view the viewer may open is a link, and nothing else is", () => {
    const html = render(PLACE_TABS);
    for (const tab of PLACE_TABS) {
      expect(html).toContain(`href="${placeTabHref("p-1", tab, "org-1")}"`);
      expect(html).toContain(`>${PLACE_TAB_LABEL[tab]}<`);
    }
    // The reverse direction: no link the vocabulary does not name.
    expect(links(html)).toHaveLength(PLACE_TABS.length);
  });

  it("exactly one pill is the current page, and it is the pathname's view", () => {
    const html = render(PLACE_TABS);
    expect(current(html)).toHaveLength(1);
    expect(html).toMatch(
      /aria-current="page"[^>]*>Activity<|href="[^"]*\/activity[^"]*"[^>]*aria-current="page"/,
    );
  });

  it("a viewer's set is the row — Capabilities and Admin are not offered", () => {
    const html = render(["profile", "activity"]);
    expect(links(html)).toHaveLength(2);
    expect(html).not.toContain("Capabilities");
    expect(html).not.toContain("Admin");
  });

  it("a single view renders the label, not a row with nowhere to go", () => {
    nav.pathname = "/places/p-1/profile";
    const html = render(["profile"]);
    expect(html).not.toContain("<nav");
    expect(links(html)).toHaveLength(0);
    expect(html).toContain("Profile");
  });

  it("carries ?org= exactly as the URL answers it, and omits it when absent", () => {
    nav.org = "";
    const html = render(PLACE_TABS);
    expect(html).toContain('href="/places/p-1/profile"');
    expect(html).not.toContain("org=");
  });

  it("the title is still the one h1, and the row sits under it in the flow", () => {
    const html = render(PLACE_TABS);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.indexOf("<h1")).toBeLessThan(html.indexOf("<nav"));
    expect(html).toContain('aria-label="Place views"');
  });
});
