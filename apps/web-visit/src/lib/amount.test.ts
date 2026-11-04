import { describe, expect, it } from "vitest";
import { readAmount } from "./amount";

describe("readAmount", () => {
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
