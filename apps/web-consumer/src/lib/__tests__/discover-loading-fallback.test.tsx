import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DiscoverFallback } from "@/components/consumer/home/DiscoverFallback";

// The skeleton stays in the tree. Home's layout does not use it while the
// four pills are Soon (MESITA-2168): a Suspense wait in front of an empty
// state reads as a failed load.
describe("Home's loading fallback", () => {
  it("is the rounded skeleton", () => {
    const html = renderToStaticMarkup(<DiscoverFallback />);
    expect(html).toContain("rounded-2xl");
    expect(html).not.toContain("bg-foreground");
  });

  it("the Soon layout paints the page, not this fallback", async () => {
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
