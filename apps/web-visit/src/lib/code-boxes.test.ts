// Auth-adjacent (MESITA-3818): the six waiter-code boxes feed sign-gate.
import { describe, expect, it } from "vitest";
import { backspaceCode, codeDigits, fillCode } from "./code-boxes";
import { waiterCode } from "./sign-gate";

describe("the waiter code boxes", () => {
  it("a paste fills from the box onward, drops non-digits and focuses the last filled", () => {
    expect(fillCode("", 0, "12-34 56")).toEqual({ code: "123456", focus: 5 });
    expect(fillCode("9", 2, "4567890")).toEqual({ code: "9 4567", focus: 5 });
    expect(fillCode("12", 2, "ab")).toEqual({ code: "12", focus: 2 });
  });

  it("one digit moves to the next box", () => {
    expect(fillCode("12", 2, "3")).toEqual({ code: "123", focus: 3 });
    expect(fillCode("12345", 5, "6")).toEqual({ code: "123456", focus: 5 });
  });

  it("backspace clears the box, or the one before when empty", () => {
    expect(backspaceCode("123", 2)).toEqual({ code: "12", focus: 2 });
    expect(backspaceCode("12", 2)).toEqual({ code: "1", focus: 1 });
    expect(backspaceCode("", 0)).toEqual({ code: "", focus: 0 });
  });

  it("a gap never passes as a six-digit code", () => {
    const gapped = fillCode("12", 3, "456").code;
    expect(codeDigits(gapped)).toEqual(["1", "2", "", "4", "5", "6"]);
    expect(waiterCode(gapped)).toBeNull();
    expect(waiterCode(fillCode(gapped, 2, "3").code)).toBe("123456");
  });
});
