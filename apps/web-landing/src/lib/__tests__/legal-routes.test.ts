import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import * as privacyPage from "@/app/privacy/page";
import * as termsPage from "@/app/terms/page";
import { DRAFT_DATE } from "@/components/landing/legal";

// /terms and /privacy exist, and the sitemap knows it (MESITA-1888).
//
// The bug this pins: web-consumer and mobile-consumer shipped "Terms of use"
// and "Privacy policy" rows pointing at mesita.ai/terms and mesita.ai/privacy
// while web-landing had neither route, so both rows 404'd for months with
// every check green. web-landing had no test runner at all, which is why
// nothing could have caught it.
//
// It is a bijection, not a checklist: every static page.tsx under src/app must
// appear in the sitemap and every sitemap URL must have a page behind it. On
// main before this change it fails in both directions (no routes, no entries),
// which is the proof that it is not vacuous.

const APP_DIR = join(__dirname, "..", "..", "app");
const HOST = "https://mesita.ai";

/** Static routes as URL paths ("/" , "/terms"). Dynamic segments excluded. */
function staticRoutes(): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // "[code]" segments have no fixed URL, so they cannot be sitemapped.
        if (entry.startsWith("[")) continue;
        walk(full, `${rel}/${entry}`);
      } else if (entry === "page.tsx") {
        out.push(rel === "" ? "/" : rel);
      }
    }
  };
  walk(APP_DIR, "");
  return out.sort();
}

function sitemapPaths(): string[] {
  return sitemap()
    .map((e) => {
      const url = String(e.url);
      expect(url.startsWith(`${HOST}/`) || url === HOST).toBe(true);
      return url === HOST ? "/" : url.slice(HOST.length);
    })
    .sort();
}

describe("the legal routes the consumer clients link to", () => {
  it("both pages exist on disk", () => {
    expect(staticRoutes()).toEqual(
      expect.arrayContaining(["/terms", "/privacy"]),
    );
  });

  it("the sitemap and the static routes are the same set", () => {
    expect(sitemapPaths()).toEqual(staticRoutes());
  });

  it("canonicalizes on the apex, never www — the clients were pointed here", () => {
    for (const entry of sitemap()) {
      expect(String(entry.url)).not.toContain("www.");
    }
  });

  it("both pages carry a title and are marked an unreviewed draft", () => {
    const pages = { terms: termsPage, privacy: privacyPage };
    for (const [route, mod] of Object.entries(pages)) {
      expect(typeof mod.metadata.title).toBe("string");
      expect((mod.metadata.title as string).length).toBeGreaterThan(0);

      // The banner is one component, so the assertion is that each page routes
      // through it — a page that hand-rolls its own header would lose the
      // "not reviewed by a lawyer" line without failing anything else.
      const src = readFileSync(join(APP_DIR, route, "page.tsx"), "utf8");
      expect(src).toContain("LegalPage");
      expect(src).toContain("@/components/landing/legal");
    }
    const shell = readFileSync(
      join(__dirname, "..", "..", "components", "landing", "legal.tsx"),
      "utf8",
    );
    expect(shell).toContain("has not been reviewed by a lawyer");
    expect(shell).toContain(DRAFT_DATE);
  });
});
