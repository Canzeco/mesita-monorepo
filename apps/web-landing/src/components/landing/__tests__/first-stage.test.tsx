import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import Home from "@/app/page";
import { NAV_LINKS } from "@/components/landing/nav";

// FIRST STAGE ONLY (MESITA-2092). The MVP sells Citywide Catalog · Discovery
// Engines · Reservations Agent. Prepaying, rewards, visits and everything on
// the restaurant side are Second Stage, so no page on mesita.ai may sell or
// describe them, and nothing may link to the business console or the staff
// ticket host the MVP deleted.

const SECOND_STAGE =
  /\b(credits?|prepa(y|id|yments?)|rewards?|cashback|wallet|diamond|partners?|membership|stripe|tickets?|tips?)\b|business\.mesita\.ai|check\.mesita\.ai|validate\.mesita\.ai/i;

/** What a visitor reads, plus every href: tags out, links kept. */
function visible(el: ReactElement): string {
  const html = renderToStaticMarkup(el);
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
  return `${text} ${hrefs.join(" ")}`;
}

describe("mesita.ai speaks First Stage only", () => {
  const pages: [string, ReactElement][] = [
    ["/", <Home key="home" />],
    ["/terms", <TermsPage key="terms" />],
    ["/privacy", <PrivacyPage key="privacy" />],
  ];

  for (const [route, el] of pages) {
    it(`${route} names no Second Stage product and links no deleted host`, () => {
      expect(visible(el).match(SECOND_STAGE)?.[0] ?? null).toBeNull();
    });
  }

  it("the nav names the three First Stage products, in page order", () => {
    expect(NAV_LINKS.map((l) => l.label)).toEqual([
      "Catalog",
      "Discovery",
      "Reservations",
    ]);
  });

  it("the pattern bites", () => {
    expect(SECOND_STAGE.test("Prepaid Credits")).toBe(true);
    expect(SECOND_STAGE.test("rewards at the table")).toBe(true);
    expect(SECOND_STAGE.test("https://check.mesita.ai/ABC")).toBe(true);
    expect(SECOND_STAGE.test("Never call a restaurant again.")).toBe(false);
  });
});
