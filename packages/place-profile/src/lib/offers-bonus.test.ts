import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const KEYS = ["voucher_200", "voucher_1000", "voucher_5000", "voucher_welcome", "voucher_story"];

function bps(money: string, key: string): number {
  const m = money.match(new RegExp(`${key}:\\s*\\{[^}]*bonus_bps:\\s*(\\d+)`));
  if (!m) throw new Error(`no bonus_bps for ${key}`);
  return Number(m[1]);
}

function percent(offers: string, key: string): number {
  const standard = offers.match(new RegExp(`${key}:\\s*(\\d+)`));
  if (standard) return Number(standard[1]);
  const slide = offers.match(new RegExp(`bonus:\\s*(\\d+),\\s*voucher:\\s*"${key}"`));
  if (!slide) throw new Error(`no chip percent for ${key}`);
  return Number(slide[1]);
}

// Chip percents in offers.ts are the server catalog's bonus_bps / 100
// (MESITA-4208). A drift here shows the wrong bonus on a Home chip.
describe("chip bonuses match VOUCHER_CATALOG", () => {
  it("every named voucher's percent is its basis points", () => {
    const money = readFileSync(
      join(import.meta.dirname, "../../../../supabase/supabase/functions/_shared/money.ts"),
      "utf8",
    );
    const offers = readFileSync(join(import.meta.dirname, "offers.ts"), "utf8");
    for (const key of KEYS) expect(percent(offers, key)).toBe(bps(money, key) / 100);
  });
});
