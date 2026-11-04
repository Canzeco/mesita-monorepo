import { describe, expect, it } from "vitest";
import { amountText, readAmount } from "./amount";

describe("readAmount", () => {
  it("reads back the guest's bill exactly", () => {
    for (const cents of [125000, 125050, 125005, 1, 100000000]) {
      expect(readAmount(amountText(cents))).toBe(cents);
    }
  });

  it("reads what a person types as whole cents", () => {
    expect(readAmount("1,234.50")).toBe(123450);
    expect(readAmount(" 200 ")).toBe(20000);
    expect(readAmount("19.9")).toBe(1990);
    expect(readAmount("0.01")).toBe(1);
  });

  it("refuses what is not an amount", () => {
    expect(readAmount("")).toBeNull();
    expect(readAmount("0")).toBeNull();
    expect(readAmount("12.345")).toBeNull();
    expect(readAmount("-5")).toBeNull();
    expect(readAmount("abc")).toBeNull();
  });
});
