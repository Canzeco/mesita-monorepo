import { describe, expect, it } from "vitest";
import { readAmount } from "@mesita/place-profile/lib/money";
import type { PayPlace } from "@/lib/api/wallet";
import { tabSplit } from "@/lib/api/tab";
import { money } from "@/lib/api/wallet";
import { amountShown, draftAmount, draftTip, keyLive, type PadKey, payButton, payProblem, type PayProblemArgs, pressKey, readTip, tipWays } from "@/lib/pay-keypad";

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

describe("readTip", () => {
  // No tip is Other with 0 typed (MESITA-3748): 0 is a tip, empty is not.
  it("reads a typed 0 as a tip of 0", () => {
    expect(readTip(type(["0"]))).toBe(0);
    expect(readTip("0.")).toBe(0);
    expect(readTip("0.00")).toBe(0);
  });
  it("reads nothing typed, or junk, as no answer", () => {
    expect(readTip("")).toBeNull();
    expect(readTip("abc")).toBeNull();
  });
  it("reads any other amount as readAmount does", () => {
    expect(readTip("30")).toBe(3000);
    expect(readTip("0.5")).toBe(50);
  });
  it("a saved 0 tip comes back as 0", () => {
    expect(draftTip("0")).toBe("0");
    expect(draftTip("30.5")).toBe("30.50");
    expect(draftTip(undefined)).toBe("");
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

describe("payProblem", () => {
  // The screen acts on the code (Add a card), so each stop has its own.
  const paying = (p: Partial<PayPlace>, over: Partial<PayProblemArgs> = {}): PayProblemArgs => ({
    place: place(p),
    billCents: 30000,
    tipCents: 0,
    spendableCents: 0,
    useCredit: false,
    restWith: "card",
    tipWith: "card",
    cardId: "pm_1",
    ...over,
  });
  it("a card part with no saved card is add_card", () => {
    expect(payProblem(paying({}, { cardId: null }))?.code).toBe("add_card");
  });
  it("credit covering the bill needs no card", () => {
    expect(payProblem(paying({}, { cardId: null, useCredit: true, spendableCents: 30000 }))).toBeNull();
  });
  it("each other stop has its own code and a sentence", () => {
    expect(payProblem(paying({ card_ok: false }))?.code).toBe("card_unavailable");
    expect(payProblem(paying({ outside_ok: false }, { restWith: "cash", tipWith: "cash" }))?.code).toBe("cash_off");
    expect(payProblem(paying({ card_min_cents: 50000 }))?.code).toBe("card_min");
    expect(payProblem(paying({}, { restWith: "cash", tipCents: 3000, tipWith: "card" }))?.code).toBe("card_tip_alone");
    expect(payProblem(paying({ card_min_cents: 50000 }))?.message).toBeTruthy();
    expect(payProblem(paying({}))).toBeNull();
  });
});

describe("amountShown", () => {
  // The prefix and suffix are the money formatter's own for the currency.
  const zero = money(0, "mxn");
  const prefix = zero.slice(0, zero.indexOf("0"));
  const suffix = zero.slice(zero.indexOf("0") + 1);
  it("nothing typed is the prefix alone", () => {
    expect(amountShown("", "mxn")).toEqual({ prefix, body: "", suffix: "" });
  });
  it("a typed 0 is a 0", () => {
    expect(amountShown("0", "mxn")).toEqual({ prefix, body: "0", suffix });
  });
  it("groups the whole part", () => {
    expect(amountShown("1250", "mxn").body).toBe("1,250");
    expect(amountShown("1234567.89", "mxn").body).toBe("1,234,567.89");
    expect(amountShown("999", "mxn").body).toBe("999");
  });
  it("keeps the decimals exactly as typed", () => {
    expect(amountShown("12.", "mxn").body).toBe("12.");
    expect(amountShown("0.5", "mxn").body).toBe("0.5");
    expect(amountShown("1250.50", "mxn").body).toBe("1,250.50");
  });
  it("a whole amount reads as the money formatter writes it", () => {
    const a = amountShown("1250", "mxn");
    expect(a.prefix + a.body + a.suffix).toBe(money(125000, "mxn"));
    const usd = amountShown("1250", "usd");
    expect(usd.prefix + usd.body + usd.suffix).toBe(money(125000, "usd"));
  });
});

describe("payButton", () => {
  const m = (c: number) => money(c, "mxn");
  const cardLabel = "Visa •••• 4242";
  const split = (a: { bill: number; tip?: number; credit?: number; billWith: "cash" | "card"; tipWith?: "cash" | "card" }) =>
    tabSplit({
      billCents: a.bill,
      tipCents: a.tip ?? 0,
      spendableCents: a.credit ?? 0,
      useCredit: (a.credit ?? 0) > 0,
      cashBackBps: 0,
      billWith: a.billWith,
      tipWith: a.tipWith ?? a.billWith,
    });
  const btn = (s: ReturnType<typeof split>) => payButton(s, { cardLabel, m });

  it("card only: the whole amount, the card's name", () => {
    expect(btn(split({ bill: 60000, tip: 9000, billWith: "card" }))).toEqual({ button: `Pay ${m(69000)}`, line: cardLabel });
  });
  it("credit only: the whole amount, Credit", () => {
    expect(btn(split({ bill: 60000, credit: 80000, billWith: "card" }))).toEqual({ button: `Pay ${m(60000)}`, line: "Credit" });
  });
  it("credit and card: both named, name then amount", () => {
    expect(btn(split({ bill: 60000, tip: 9000, credit: 20000, billWith: "card" }))).toEqual({
      button: `Pay ${m(69000)}`,
      line: `Credit ${m(20000)} + ${cardLabel} ${m(49000)}`,
    });
  });
  it("card with a cash tip: the card amount, plus the cash", () => {
    expect(btn(split({ bill: 49000, tip: 20000, billWith: "card", tipWith: "cash" }))).toEqual({
      button: `Pay ${m(49000)}`,
      line: `+ ${m(20000)} cash`,
    });
  });
  it("credit with the rest in cash: the credit amount, plus the cash", () => {
    expect(btn(split({ bill: 60000, tip: 9000, credit: 20000, billWith: "cash" }))).toEqual({
      button: `Pay ${m(20000)}`,
      line: `+ ${m(49000)} cash`,
    });
  });
  it("credit, card and a cash tip: both named, then the cash", () => {
    expect(btn(split({ bill: 60000, tip: 9000, credit: 20000, billWith: "card", tipWith: "cash" }))).toEqual({
      button: `Pay ${m(60000)}`,
      line: `Credit ${m(20000)} + ${cardLabel} ${m(40000)} + ${m(9000)} cash`,
    });
  });
  it("credit covers the bill, the tip in cash or by card", () => {
    expect(btn(split({ bill: 60000, tip: 9000, credit: 60000, billWith: "cash", tipWith: "cash" }))).toEqual({
      button: `Pay ${m(60000)}`,
      line: `+ ${m(9000)} cash`,
    });
    expect(btn(split({ bill: 60000, tip: 9000, credit: 60000, billWith: "cash", tipWith: "card" }))).toEqual({
      button: `Pay ${m(69000)}`,
      line: `Credit ${m(60000)} + ${cardLabel} ${m(9000)}`,
    });
  });
  it("all cash: Confirm with the cash amount, no line", () => {
    expect(btn(split({ bill: 60000, tip: 9000, billWith: "cash" }))).toEqual({ button: `Confirm · ${m(69000)} cash`, line: null });
  });
  it("the button's amount is always credit + card bill + card tip", () => {
    for (const bill of [100, 49000, 60000, 300050])
      for (const tip of [0, 500, 9000])
        for (const credit of [0, 100, 20000, 60000, 999999])
          for (const billWith of ["cash", "card"] as const)
            for (const tipWith of ["cash", "card"] as const) {
              const s = split({ bill, tip, credit, billWith, tipWith });
              const inApp = s.credit_cents + s.card_bill_cents + s.card_tip_cents;
              const cash = s.cash_bill_cents + s.cash_tip_cents;
              const b = btn(s);
              expect(inApp + cash).toBe(s.total_cents);
              if (inApp === 0) expect(b).toEqual({ button: `Confirm · ${m(cash)} cash`, line: null });
              else {
                expect(b.button).toBe(`Pay ${m(inApp)}`);
                // The cash part is on the line exactly when there is one.
                expect(b.line?.endsWith(`+ ${m(cash)} cash`) ?? false).toBe(cash > 0);
              }
            }
  });
});
