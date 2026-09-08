import { describe, expect, it } from "vitest";

import { PIN_LENGTH, pinDigits } from "@/components/consumer/PinField";

// `pinDigits` is the only testable part of the ten-digit code field, and it is
// pure precisely so it CAN be tested: this package runs Vitest with
// environment "node" — no jsdom, no Testing Library — so typing into an input
// cannot be exercised at all. Everything the field promises about paste
// handling therefore has to live in a function.
//
// The cases below are the ones people actually produce. A code is read off a
// card, a screenshot or a WhatsApp message and pasted, and it arrives with
// whatever punctuation the sender used.

describe("pinDigits", () => {
  it("keeps digits and drops everything else", () => {
    expect(pinDigits("1234567890")).toBe("1234567890");
    // Grouped by the sender — the two most common shapes.
    expect(pinDigits("1234-567-890")).toBe("1234567890");
    expect(pinDigits("1234 567 890")).toBe("1234567890");
    // A code quoted in a message.
    expect(pinDigits('"1234567890"')).toBe("1234567890");
    expect(pinDigits("PIN: 1234567890")).toBe("1234567890");
  });

  it("caps at the length, so an eleventh digit cannot be typed in silently", () => {
    // maxLength stops the KEYBOARD but not a paste on every browser, and a
    // field that silently swallows the 11th character of a mistyped code is
    // how someone spends five minutes on a code that was never right.
    expect(pinDigits("12345678901234")).toBe("1234567890");
    expect(pinDigits("12345678901234").length).toBe(PIN_LENGTH);
  });

  it("returns a short string unchanged — validation is the caller's", () => {
    // The field must never pad or reject mid-typing; the counter says 3/10
    // and the button stays disabled. Rewriting the value under the guest is
    // what makes a code field feel broken.
    expect(pinDigits("123")).toBe("123");
    expect(pinDigits("")).toBe("");
    // All punctuation is a legitimate empty, not an error.
    expect(pinDigits("---")).toBe("");
  });

  it("honours a custom length", () => {
    expect(pinDigits("123456", 4)).toBe("1234");
  });
});
