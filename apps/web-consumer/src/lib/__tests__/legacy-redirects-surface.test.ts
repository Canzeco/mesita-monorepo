import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";
import { LEGACY_REDIRECTS, withSurfaceTwins } from "@/lib/legacy-redirects";

// EVERY RETIRED ADDRESS REDIRECTS UNDER /web AND /mob TOO (MESITA-2138).
//
// Next matches redirects() against the URL the browser sent, before
// middleware strips the surface prefix. Production on 2026-10-11: /wallet →
// 308 /pay, but /web/wallet and /mob/wallet → 404, and every link the app
// ever rendered carries that prefix. The other contract tests pin the BARE
// table; this one pins that next.config serves each entry twice.

describe("legacy redirects keep the guest's surface", () => {
  it("next.config serves the bare table and one surface twin per entry", async () => {
    expect(await nextConfig.redirects!()).toEqual([
      ...LEGACY_REDIRECTS,
      ...withSurfaceTwins(LEGACY_REDIRECTS),
    ]);
  });

  it("a twin matches only /web and /mob, and keeps the prefix on the way out", () => {
    const twins = withSurfaceTwins(LEGACY_REDIRECTS);
    expect(twins).toHaveLength(LEGACY_REDIRECTS.length);
    twins.forEach((twin, i) => {
      const bare = LEGACY_REDIRECTS[i];
      expect(twin.source).toBe(`/:surface(web|mob)${bare.source}`);
      expect(twin.destination).toBe(`/:surface${bare.destination}`);
      expect(twin.permanent).toBe(bare.permanent);
    });
  });

  it("the production case: /web/wallet/buy and /mob/wallet/buy land on Pay", () => {
    const wallet = withSurfaceTwins(LEGACY_REDIRECTS).find(
      (r) => r.source === "/:surface(web|mob)/wallet/:id/:path*",
    );
    expect(wallet?.destination).toBe("/:surface/pay");
  });

  it("no bare source is itself surface-prefixed (a twin would double it)", () => {
    expect(
      LEGACY_REDIRECTS.filter((r) => /^\/(web|mob)(\/|$)/.test(r.source)),
    ).toEqual([]);
  });
});
