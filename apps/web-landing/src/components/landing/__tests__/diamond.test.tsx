import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Hero } from "@/components/landing/hero";
import { RewardsProgram } from "@/components/landing/rewards-program";

// DIAMOND (MESITA-2044, MESITA-2046). Pato: "there are no classes, either you
// are diamond or you are not" — and then "Don't call diamond list, just
// diamond". The landing names it the same way the app does — "Diamond", one
// word, every time — and never a metal, a ladder word, or the retired
// "Diamond List".

const METALS =
  /\b(Bronze|Silver|Gold|VIP)\b|Diamond List|Lista Diamante|Diamond (class|tier|rung)/;
const LADDER_WORDS =
  /\b(class|classes|tier|tiers|rank|rung|rungs|level|ladder|climb)\b|unlock a higher/i;

/** What a visitor reads: tags, attributes and entities out. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

describe("the landing says Diamond", () => {
  // Rewards is where Diamond lives; the Hero's third chip is Credits now
  // (2026-09-28), so the Hero is held to the naming rule but not to
  // mentioning Diamond at all.
  it("RewardsProgram names Diamond, never a metal or a ladder", () => {
    const read = text(renderToStaticMarkup(<RewardsProgram />));
    expect(read).toContain("Diamond");
    expect(read.match(METALS)?.[0] ?? null).toBeNull();
    expect(read.match(LADDER_WORDS)?.[0] ?? null).toBeNull();
  });

  it("Hero never says a metal or a ladder", () => {
    const read = text(renderToStaticMarkup(<Hero />));
    expect(read.match(METALS)?.[0] ?? null).toBeNull();
    expect(read.match(LADDER_WORDS)?.[0] ?? null).toBeNull();
  });

  it("the patterns bite", () => {
    expect(METALS.test("The Diamond List")).toBe(true);
    expect(METALS.test("Gold")).toBe(true);
    expect(LADDER_WORDS.test("The rung that compounds")).toBe(true);
    expect(METALS.test("Diamond Invitation only")).toBe(false);
  });
});
