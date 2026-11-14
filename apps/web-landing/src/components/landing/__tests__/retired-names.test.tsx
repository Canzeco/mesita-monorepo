import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import Home from "@/app/page";

// RETIRED NAMES STAY OFF mesita.ai. The page sells 🦚 Main's eleven products
// (MESITA-3106), money products included. What Main retired must not come
// back through the landing: the Wallet tab (now Pay), the Diamond and
// membership tiers, staff tickets and tips, and the staff hosts the MVP
// deleted (check., validate.). Cashback came back as Business › Payments'
// Cashback-as-Credits (MESITA-3837), so the landing may name it (MESITA-3845).

const RETIRED =
  /\b(wallet|diamond|memberships?|tickets?|tips?)\b|check\.mesita\.ai|validate\.mesita\.ai/i;

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

describe("mesita.ai names no retired product", () => {
  const pages: [string, ReactElement][] = [
    ["/", <Home key="home" />],
    ["/terms", <TermsPage key="terms" />],
    ["/privacy", <PrivacyPage key="privacy" />],
  ];

  for (const [route, el] of pages) {
    it(`${route} names no retired product and links no deleted host`, () => {
      expect(visible(el).match(RETIRED)?.[0] ?? null).toBeNull();
    });
  }

  it("the pattern bites", () => {
    expect(RETIRED.test("Open your Wallet")).toBe(true);
    expect(RETIRED.test("Diamond membership")).toBe(true);
    expect(RETIRED.test("https://check.mesita.ai/ABC")).toBe(true);
    expect(RETIRED.test("Credit Prepayments")).toBe(false);
  });
});
