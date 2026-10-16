import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DiscoverFallback } from "@/components/consumer/home/DiscoverFallback";

// The skeleton stays in the tree. Home's layout does not mount it: Places
// loads its own rails (MESITA-2254), and a Suspense wait in front of a Soon
// page (Social, Chat, Favs) reads as a failed load.
describe("Home's loading fallback", () => {
  it("is the rounded skeleton", () => {
    const html = renderToStaticMarkup(<DiscoverFallback />);
    expect(html).toContain("rounded-2xl");
    expect(html).not.toContain("bg-foreground");
  });

  it("the layout paints the page, not this fallback", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const layout = readFileSync(
      join(__dirname, "../../app/(shell)/(discovery)/discover/layout.tsx"),
      "utf8",
    );
    expect(layout).not.toContain("DiscoverFallback");
    expect(layout).not.toContain("HomeDeckBoundary");
    expect(layout).toContain("<ModeRail />");
    expect(layout).toContain("{children}");
  });
});
