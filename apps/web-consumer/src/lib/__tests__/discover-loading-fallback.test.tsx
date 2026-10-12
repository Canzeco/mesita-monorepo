import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DiscoverFallback } from "@/components/consumer/home/DiscoverFallback";

// One Suspense fallback serves Home's two pills, Swipe and Favs (MESITA-2163).
// Both are card layouts on the page ground, so both wait on the rounded
// skeleton; Scroll's ink block left with Scroll.
describe("Home's loading fallback", () => {
  it("is the rounded skeleton", () => {
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
