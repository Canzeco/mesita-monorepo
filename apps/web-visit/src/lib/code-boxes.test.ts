// Auth-adjacent (MESITA-3818, MESITA-4521): the four waiter-code boxes feed sign-gate.
import { describe, expect, it } from "vitest";
import { backspaceCode, codeDigits, fillCode, padPress } from "./code-boxes";
import { waiterCode } from "./sign-gate";

describe("the waiter code boxes", () => {
  it("a paste fills from the box onward, drops non-digits and focuses the last filled", () => {
    expect(fillCode("", 0, "12-34 56")).toEqual({ code: "1234", focus: 3 });
    expect(fillCode("9", 2, "4567890")).toEqual({ code: "9 45", focus: 3 });
    expect(fillCode("12", 2, "ab")).toEqual({ code: "12", focus: 2 });
  });

  it("one digit moves to the next box", () => {
    expect(fillCode("12", 2, "3")).toEqual({ code: "123", focus: 3 });
    expect(fillCode("123", 3, "4")).toEqual({ code: "1234", focus: 3 });
  });

  it("backspace clears the box, or the one before when empty", () => {
    expect(backspaceCode("123", 2)).toEqual({ code: "12", focus: 2 });
    expect(backspaceCode("12", 2)).toEqual({ code: "1", focus: 1 });
    expect(backspaceCode("", 0)).toEqual({ code: "", focus: 0 });
  });

  it("a gap never passes as a four-digit code", () => {
    const gapped = fillCode("1", 2, "34").code;
    expect(codeDigits(gapped)).toEqual(["1", "", "3", "4"]);
    expect(waiterCode(gapped)).toBeNull();
    expect(waiterCode(fillCode(gapped, 1, "2").code)).toBe("1234");
  });

  // MESITA-4103: the in-page pad.
  it("the pad types into the first empty box and stops at four", () => {
    let code = "";
    for (const k of ["1", "2", "3", "4", "5"] as const) code = padPress(code, k);
    expect(code).toBe("1234");
    expect(waiterCode(code)).toBe("1234");
    expect(padPress("12 4", "3")).toBe("1234");
  });

  it("the pad's ⌫ clears the last filled box", () => {
    expect(padPress("123", "back")).toBe("12");
    expect(padPress("", "back")).toBe("");
    expect(padPress("12 4", "back")).toBe("12");
  });
});
