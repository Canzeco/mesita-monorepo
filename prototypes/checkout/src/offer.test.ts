import { describe, expect, it } from "vitest";
import { type Offer, VOUCHERS, basketLabel, selectOffer } from "./offer";

const all = VOUCHERS;
const pick = (...ids: string[]) => VOUCHERS.filter((v) => ids.includes(v.id));
const run = (shortfall: number, opts: Partial<{ tip: number; newGuest: boolean; checked: typeof VOUCHERS; upsellingOn: boolean }> = {}) =>
  selectOffer({ shortfall, tip: opts.tip ?? 0, newGuest: opts.newGuest ?? false, checked: opts.checked ?? all, upsellingOn: opts.upsellingOn ?? true });
const label = (o: Offer | null) => (o ? basketLabel(o) : null);

describe("selectOffer", () => {
  it("offers Welcome to a new guest when it covers the shortfall", () => {
    expect(label(run(90, { newGuest: true }))).toBe("Welcome");
  });

  it("never offers Welcome to a returning guest", () => {
    expect(label(run(90))).toBe("Small");
  });

  it("may use Welcome as part of a basket, at most once", () => {
    // 5,050: no single voucher covers it; Big + Welcome (5,100) beats Big + Small (5,200).
    expect(label(run(5050, { newGuest: true }))).toBe("Big + Welcome");
    const o = run(5300, { newGuest: true })!;
    expect(o.lines.find((l) => l.voucher.id === "welcome")?.qty ?? 0).toBeLessThanOrEqual(1);
  });

  it("150 → Small", () => expect(label(run(150))).toBe("Small"));
  it("430 → Medium", () => expect(label(run(430))).toBe("Medium"));
  it("4,000 → Big", () => expect(label(run(4000))).toBe("Big"));

  it("7,000 → the cheapest covering basket, fewest vouchers on a tie", () => {
    const o = run(7000)!;
    expect(o.price).toBe(7000);
    expect(label(o)).toBe("2 × Medium + Big");
    expect(o.count).toBe(3);
  });

  it("uses only checked vouchers", () => {
    expect(label(run(150, { checked: pick("medium", "big") }))).toBe("Medium");
    expect(label(run(1500, { checked: pick("small", "medium") }))).toBe("3 × Small + Medium");
  });

  it("offers nothing when upselling is off or nothing is checked", () => {
    expect(run(430, { upsellingOn: false })).toBeNull();
    expect(run(430, { checked: [] })).toBeNull();
  });

  it("offers nothing when no basket of at most 5 vouchers covers it", () => {
    expect(run(25_001)).toBeNull();
    expect(run(1001, { checked: pick("small") })).toBeNull();
  });

  it("offers nothing when there is no shortfall", () => expect(run(0)).toBeNull());

  it("charges the basket plus the tip in one go", () => {
    const o = run(430, { tip: 73 })!;
    expect(o.charge).toBe(1073);
    expect(o.bonus).toBe(200);
  });
});
