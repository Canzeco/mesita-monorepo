import { describe, expect, it } from "vitest";

import {
  MESITA_PRIVACY_URL,
  MESITA_SITE_URL,
  MESITA_TERMS_URL,
} from "@/lib/mesita-contact";

// The host the shipped legal rows point at (MESITA-1888).
//
// Me › Help › Legal linked to https://www.mesita.ai/terms and /privacy for
// months. Two things were wrong at once: web-landing had no such routes, and
// it canonicalizes on the APEX — `metadataBase`, sitemap.ts and robots.ts all
// say https://mesita.ai with no `www.`, and no www host was stood up. So the
// rows 404'd. The routes exist now; this pins the host so a `www.` cannot come
// back on the constants that cross the app boundary.

describe("public Mesita URLs", () => {
  it("carries no www. host", () => {
    for (const url of [MESITA_SITE_URL, MESITA_TERMS_URL, MESITA_PRIVACY_URL]) {
      expect(url).not.toContain("www.");
      expect(url.startsWith("https://mesita.ai")).toBe(true);
    }
  });

  it("points the legal rows at the two web-landing routes", () => {
    expect(MESITA_TERMS_URL).toBe("https://mesita.ai/terms");
    expect(MESITA_PRIVACY_URL).toBe("https://mesita.ai/privacy");
  });
});
