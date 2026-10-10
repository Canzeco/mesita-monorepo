import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

let pathname = "/discover/feed";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { DiscoverFallback } from "@/components/consumer/home/DiscoverFallback";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// One Suspense fallback serves Home's four pills (MESITA-2105, eng review R2).
// Scroll's is a full-bleed ink block, the same shape as the photo that
// replaces it; the other three keep the rounded skeleton they always had.
// The change must stay on Scroll.
describe("Home's loading fallback", () => {
  afterEach(() => {
    pathname = "/discover/feed";
  });

  it("Scroll waits on an ink block", () => {
    pathname = CONSUMER_ROUTES.discoverTabs.scroll;
    const html = renderToStaticMarkup(<DiscoverFallback />);
    expect(html).toContain("bg-foreground");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("rounded-2xl");
  });

  it.each([
    ["Home", CONSUMER_ROUTES.discoverTabs.feed],
    ["Chat", CONSUMER_ROUTES.discoverTabs.chat],
    ["Favs", CONSUMER_ROUTES.discoverTabs.favs],
  ])("%s keeps its rounded skeleton", (_label, path) => {
    pathname = path;
    const html = renderToStaticMarkup(<DiscoverFallback />);
    expect(html).toContain("rounded-2xl");
    expect(html).not.toContain("bg-foreground");
  });

  it("the layout uses this fallback, not an inline one", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const layout = readFileSync(
      join(__dirname, "../../app/(shell)/(discovery)/discover/layout.tsx"),
      "utf8",
    );
    expect(layout).toContain("<Suspense fallback={<DiscoverFallback />}>");
  });
});
