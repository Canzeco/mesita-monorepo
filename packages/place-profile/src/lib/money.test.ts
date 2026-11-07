// MESITA-3304: a typed amount is money; a misread peso pays the wrong sum.
import { describe, expect, it } from "vitest";
import { amountText, clockTime, readAmount } from "./money";

describe("readAmount", () => {
  it("reads pesos and centavos on the digits", () => {
    expect(readAmount("170")).toBe(17000);
    expect(readAmount("170.5")).toBe(17050);
    expect(readAmount("170.50")).toBe(17050);
    expect(readAmount("1,234.05")).toBe(123405);
    expect(readAmount(" 0.10 ")).toBe(10);
    expect(readAmount("170.")).toBe(17000);
  });
  it("refuses what is not one amount", () => {
    for (const bad of ["", "0", "0.00", "-5", "1.234", "abc", "1e3", "12345678", ".5"]) {
      expect(readAmount(bad), bad).toBeNull();
    }
  });
  it("round-trips through the field's text", () => {
    for (const c of [1, 99, 100, 17050, 123405]) expect(readAmount(amountText(c))).toBe(c);
  });
});

describe("clockTime", () => {
  it("prints HH:mm today and the date first on another day", () => {
    const now = new Date(2026, 10, 7, 15, 0);
    expect(clockTime(new Date(2026, 10, 7, 9, 4).toISOString(), now)).toBe("09:04");
    expect(clockTime(new Date(2026, 10, 6, 23, 59).toISOString(), now)).toBe("6 Nov · 23:59");
  });
});
