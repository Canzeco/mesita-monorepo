import { describe, expect, it } from "vitest";
import { readAmount } from "@mesita/place-profile/lib/money";
import type { PayPlace } from "@/lib/api/wallet";
import { draftAmount, keyLive, type PadKey, payProblem, type PayProblemArgs, pressKey, tipWays } from "@/lib/pay-keypad";

// Money (MVP test rule): the keypad is the only way a guest types a bill or
// a tip, so every text it can build must be one readAmount reads; and the
// tip ways the Method step offers must be ones Pay accepts (MESITA-3739).

const type = (keys: PadKey[]) => keys.reduce((t, k) => pressKey(t, k), "");

describe("pressKey", () => {
  it("types digits and a decimal point", () => {
    expect(type(["1", "2", "5", ".", "5", "0"])).toBe("125.50");
  });
  it("a leading point becomes 0.", () => {
    expect(type(["."])).toBe("0.");
    expect(type([".", "5"])).toBe("0.5");
  });
  it("a leading zero gives way to the next digit", () => {
    expect(type(["0", "7"])).toBe("7");
    expect(type(["0", "0"])).toBe("0");
  });
  it("ignores a second point", () => {
    expect(type(["1", ".", "2", "."])).toBe("1.2");
  });
  it("caps two decimals and seven integer digits", () => {
    expect(type(["9", ".", "9", "9", "9"])).toBe("9.99");
    expect(type(["1", "2", "3", "4", "5", "6", "7", "8"])).toBe("1234567");
  });
  it("back deletes to empty and stays empty", () => {
    expect(type(["4", "back", "back"])).toBe("");
  });
  it("keyLive is false exactly when a key would change nothing", () => {
    expect(keyLive("9.99", "5")).toBe(false);
    expect(keyLive("1.2", ".")).toBe(false);
    expect(keyLive("", "back")).toBe(false);
    expect(keyLive("12", "3")).toBe(true);
  });
  it("any key sequence yields empty text or text readAmount reads", () => {
    const keys: PadKey[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "back"];
    let seed = 3739;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let run = 0; run < 1000; run++) {
      let text = "";
      for (let i = 0; i < 14; i++) {
        text = pressKey(text, keys[Math.floor(next() * keys.length)]!);
        const zero = /^0*\.?0*$/.test(text);
        expect(text === "" || zero || readAmount(text) !== null, `"${text}"`).toBe(true);
      }
    }
  });
});

describe("draftAmount", () => {
  it("puts an old draft into the keypad's form", () => {
    expect(draftAmount("1,250")).toBe("1250");
    expect(draftAmount("250.5")).toBe("250.50");
    expect(draftAmount("abc")).toBe("");
    expect(draftAmount(undefined)).toBe("");
  });
});

const place = (p: Partial<PayPlace> = {}): PayPlace => ({
  place_id: "p",
  name: "Place",
  photo: null,
  address: null,
  marks: { tier: null, mesita_pay: true },
  distance_m: null,
  currency: "mxn",
  card_ok: true,
  available_cents: 0,
  pending_cents: 0,
  cashback_bps: 0,
  test_mode: false,
  card_min_cents: 1000,
  paid_recent: null,
  outside_ok: true,
  outside_bps: 0,
  ...p,
});

const covered = (p: Partial<PayPlace>, tipCents: number, cardId: string | null = "pm_1"): Omit<PayProblemArgs, "tipWith"> => ({
  place: place(p),
  billCents: 30000,
  tipCents,
  spendableCents: 50000,
  useCredit: true,
  restWith: null,
  cardId,
});

describe("tipWays", () => {
  it("credit pays the bill: the tip can go cash or card", () => {
    expect(tipWays(covered({}, 3000))).toEqual(["cash", "card"]);
  });
  it("no card on file: cash only", () => {
    expect(tipWays(covered({}, 3000, null))).toEqual(["cash"]);
  });
  it("a tip under the card minimum: cash only", () => {
    expect(tipWays(covered({ card_min_cents: 5000 }, 3000))).toEqual(["cash"]);
  });
  it("cash off: card only", () => {
    expect(tipWays(covered({ outside_ok: false }, 3000))).toEqual(["card"]);
  });
  it("cards off and cash off: nothing", () => {
    expect(tipWays(covered({ outside_ok: false, card_ok: false }, 3000))).toEqual([]);
  });
  it("every offered way is one Pay accepts, across places and splits", () => {
    for (const card_ok of [true, false])
      for (const outside_ok of [true, false])
        for (const card_min_cents of [0, 1000, 5000])
          for (const tip of [0, 500, 3000])
            for (const cardId of ["pm_1", null]) {
              const a = covered({ card_ok, outside_ok, card_min_cents }, tip, cardId);
              for (const w of tipWays(a)) expect(payProblem({ ...a, tipWith: w })).toBeNull();
            }
  });
});
