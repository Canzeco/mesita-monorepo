import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";
import {
  LEGACY_REDIRECTS,
  SURFACE_PREFIX_REDIRECTS,
} from "@/lib/legacy-redirects";

// THE /web AND /mob PREFIXES ARE RETIRED (MESITA-3013). The app is served at
// its real paths; every old prefixed link (shared places, a Stripe return
// URL, a bookmark) 308s once to the bare path, and a retired bare address
// then takes its own hop through the legacy table.

describe("retired surface prefixes", () => {
  it("next.config serves the legacy table, then the two prefix catches", async () => {
    expect(await nextConfig.redirects!()).toEqual([
      ...LEGACY_REDIRECTS,
      ...SURFACE_PREFIX_REDIRECTS,
    ]);
  });

  it("/web and /mob, bare or with a path, land on the bare path", () => {
    expect(SURFACE_PREFIX_REDIRECTS).toEqual([
      { source: "/:surface(web|mob)", destination: "/", permanent: true },
      {
        source: "/:surface(web|mob)/:path*",
        destination: "/:path*",
        permanent: true,
      },
    ]);
  });

  it("no legacy source is itself surface-prefixed", () => {
    expect(
      LEGACY_REDIRECTS.filter((r) => /^\/(web|mob)(\/|$)/.test(r.source)),
    ).toEqual([]);
  });
});
