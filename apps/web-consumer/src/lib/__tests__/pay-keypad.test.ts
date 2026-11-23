import { describe, expect, it } from "vitest";
import { readAmount } from "@mesita/place-profile/lib/money";
import { money } from "@/lib/api/wallet";
import { amountShown, draftAmount, draftTip, keyLive, type PadKey, pressKey, readTip } from "@/lib/pay-keypad";

// Money (MVP test rule): the keypad is the only way a guest types a bill or
// a tip, so every text it can build must be one readAmount reads
// (MESITA-3739).

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

describe("amountShown", () => {
  // The prefix and suffix are the money formatter's own for the currency.
  const zero = money(0, "mxn");
  const prefix = zero.slice(0, zero.indexOf("0"));
  const suffix = zero.slice(zero.indexOf("0")).replace(/^[0.,]+/, "");
  it("nothing typed is a muted 0.00", () => {
    expect(amountShown("", "mxn")).toEqual({ prefix, body: "", ghost: "0.00", suffix });
  });
  it("a typed 0 is a 0, with its cents to come", () => {
    expect(amountShown("0", "mxn")).toEqual({ prefix, body: "0", ghost: ".00", suffix });
  });
  it("always reads with two decimals (MESITA-3766)", () => {
    const full = (t: string) => { const s = amountShown(t, "mxn"); return s.body + s.ghost; };
    expect(full("20")).toBe("20.00");
    expect(full("20.")).toBe("20.00");
    expect(full("20.5")).toBe("20.50");
    expect(full("20.55")).toBe("20.55");
    expect(full("1250")).toBe("1,250.00");
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
  it("a typed amount, with its ghost cents, reads as the money formatter writes it", () => {
    for (const [text, cents] of [["1250", 125000], ["1250.5", 125050], ["0", 0]] as const) {
      for (const cur of ["mxn", "usd"]) {
        const a = amountShown(text, cur);
        expect(a.prefix + a.body + a.ghost + a.suffix).toBe(money(cents, cur));
      }
    }
  });
});
