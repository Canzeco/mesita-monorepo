// The promo chip and the place-detail Rewards box print the SAME sentence —
// "Up to N% Discount for You" — on the same screen, and for a month they
// printed different N (MESITA-1019). The box asked the engine; the chip
// resolved N from the place's four v4 rate columns, which stopped being prices
// when v10 additive shipped. On an aggressive place a bronze·free guest was
// told "Up to 30%" in the header and "Up to 60%" below it, and 30 was neither
// the guaranteed base (20) nor the reachable ceiling (60).
//
// Two failure modes are pinned here, because fixing one without the other just
// moves the bug:
//   1. the ARITHMETIC has one definition, and both surfaces call it
//   2. the chip's number is a function of the QUOTE alone — the rate columns
//      cannot move it

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { upToPercentFromQuote } from "@/lib/discount-quote";
import type { RewardQuote } from "@/lib/api/tickets";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

// The live v11 visits grid at the time of the fix: an aggressive place pays a
// bronze·free guest a base of 20, and the four bonuses add 40 more.
const AGGRESSIVE_BRONZE_FREE: RewardQuote = {
  strategy: "aggressive",
  classKey: "standard",
  additive: true,
  isFirstVisit: true,
  base: 20,
  bonuses: { welcome: 10, story: 10, google: 15, mesita: 5 },
  ladder: { standard: 20, influencer: 30, premium: 40, aura: 50 },
  storyEligible: true,
  cap: 200,
};

describe("upToPercentFromQuote is the one definition of the ceiling", () => {
  it("ADDS every component under the additive engine", () => {
    expect(upToPercentFromQuote(AGGRESSIVE_BRONZE_FREE)).toBe(60);
  });

  it("takes the single best rung on the legacy best-of fallback", () => {
    // Summing here would over-promise — the one direction of error a discount
    // quote must never make.
    expect(
      upToPercentFromQuote({ ...AGGRESSIVE_BRONZE_FREE, additive: false }),
    ).toBe(20);
  });

  it("drops the welcome bonus for a returning guest, on the server's word", () => {
    // `is_first_visit` on the place payload was written by no Edge Function
    // and read as `undefined` everywhere, so the old column path quoted the
    // WELCOME rung to every guest forever. First-visit is a server fact now.
    const returning: RewardQuote = {
      ...AGGRESSIVE_BRONZE_FREE,
      isFirstVisit: false,
      bonuses: { ...AGGRESSIVE_BRONZE_FREE.bonuses, welcome: 0 },
    };
    expect(upToPercentFromQuote(returning)).toBe(50);
  });

  it("never promises more than the whole bill", () => {
    expect(
      upToPercentFromQuote({
        ...AGGRESSIVE_BRONZE_FREE,
        base: 80,
        bonuses: { welcome: 20, story: 20, google: 20, mesita: 20 },
      }),
    ).toBe(100);
  });
});

describe("both surfaces read that one definition", () => {
  it.each([
    ["the promo chip", "components/consumer/PromoChip.tsx"],
    ["the Rewards box", "components/consumer/place-detail/rewards.tsx"],
  ])("%s calls upToPercentFromQuote", (_label, rel) => {
    expect(read(rel)).toContain("upToPercentFromQuote(");
  });

  it("the chip resolves no rate of its own", () => {
    const src = read("components/consumer/PromoChip.tsx");
    // Any of these coming back means a second pricing path was reintroduced.
    for (const columnRead of [
      "welcome_free_rate",
      "welcome_premium_rate",
      "free_rate",
      "premium_rate",
      "is_first_visit",
      "resolvePromoRateFromPlaceRow",
    ]) {
      const code = src.split("\n").filter((l) => !l.trim().startsWith("//"));
      expect(code.join("\n")).not.toContain(columnRead);
    }
  });

  it("promo-rates exports no percentage resolver at all", () => {
    const src = read("lib/promo-rates.ts");
    expect(src).not.toContain("export function resolvePromoRateFromPlaceRow");
    expect(src).not.toContain("function resolveActivePromoRate");
  });
});

describe("the chip prints the engine's number, whatever the columns say", () => {
  // The columns still ride on every place row — they carry strategy identity —
  // so the guard that matters is that moving them cannot move the percentage.
  const renderChip = async (quote: RewardQuote | null, loading = false) => {
    vi.resetModules();
    vi.doMock("@/lib/discount-quotes", () => ({
      useDiscountQuote: () => ({ quote, loading }),
    }));
    const { PromoChip } = await import("@/components/consumer/PromoChip");
    return (place: Record<string, unknown>) =>
      renderToStaticMarkup(
        <PromoChip
          place={
            {
              id: "p1",
              promoting: true,
              ...place,
            } as never
          }
          showWhenEmpty
        />,
      );
  };

  it("quotes 60% on the aggressive place that used to read 30%", async () => {
    const render = await renderChip(AGGRESSIVE_BRONZE_FREE);
    expect(render({})).toContain("Up to 60% Discount for You");
  });

  it("ignores the rate columns entirely", async () => {
    const render = await renderChip(AGGRESSIVE_BRONZE_FREE);
    const withColumns = render({
      welcome_free_rate: 30,
      welcome_premium_rate: 50,
      free_rate: 10,
      premium_rate: 30,
    });
    const withoutColumns = render({});
    expect(withColumns).toBe(withoutColumns);
    expect(withColumns).toContain("Up to 60%");
    expect(withColumns).not.toContain("30%");
  });

  it("states the absence when the place runs a zero strategy", async () => {
    const render = await renderChip({
      ...AGGRESSIVE_BRONZE_FREE,
      strategy: "zero",
      base: 0,
      bonuses: { welcome: 0, story: 0, google: 0, mesita: 0 },
    });
    // Even with generous-looking columns on the row.
    expect(render({ welcome_free_rate: 30 })).toContain("No Reward for You");
  });

  it("states the absence when the engine gave no answer", async () => {
    const render = await renderChip(null);
    expect(render({ welcome_free_rate: 30 })).toContain("No Reward for You");
  });

  it("holds a skeleton in flight rather than flashing the opposite answer", async () => {
    const render = await renderChip(null, true);
    const html = render({});
    expect(html).not.toContain("No Reward for You");
    expect(html).toContain("animate-pulse");
  });

  it("never quotes a place the server says isn't promoting", async () => {
    // The gate runs before the quote is requested — an ordinary listing costs
    // no round trip and can never show a ribbon.
    const render = await renderChip(AGGRESSIVE_BRONZE_FREE);
    expect(render({ promoting: false })).toContain("No Reward for You");
  });
});
