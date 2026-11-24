// Money and auth (MESITA-4871): the keypad is the only way a waiter types a
// bill, a tip or their code.
import { describe, expect, it } from "vitest";
import { readAmount } from "@mesita/place-profile/lib/money";
import { amountParts, type Key, pressAmount, pressCode, tipOf } from "./waiter-pad";

const amount = (keys: string) => [...keys].reduce((t, k) => pressAmount(t, (k === "<" ? "back" : k) as Key), "");

describe("the waiter's keypad", () => {
  it("types an amount of two decimals at most", () => {
    expect(readAmount(amount("500"))).toBe(50_000);
    expect(amount("12.345")).toBe("12.34");
    expect(amount("1..5")).toBe("1.5");
    expect(amount(".5")).toBe("0.5");
    expect(amount("05")).toBe("5");
    expect(amount("50<")).toBe("5");
  });
  it("stops at the server's ceiling", () => {
    expect(amount("100000")).toBe("100000");
    expect(amount("100001")).toBe("10000");
  });
  it("reads an empty tip as none", () => {
    expect(tipOf("")).toBe(0);
    expect(tipOf("0")).toBe(0);
    expect(tipOf("30.5")).toBe(3050);
  });
  it("types eight digits, never more", () => {
    expect([..."123456789"].reduce((c, k) => pressCode(c, k as Key), "")).toBe("12345678");
    expect(pressCode("12", ".")).toBe("12");
    expect(pressCode("12", "back")).toBe("1");
  });
  it("shows the cents not typed yet", () => {
    expect(amountParts("1250")).toEqual({ typed: "1,250", ghost: ".00" });
    expect(amountParts("1.5")).toEqual({ typed: "1.5", ghost: "0" });
  });
});
