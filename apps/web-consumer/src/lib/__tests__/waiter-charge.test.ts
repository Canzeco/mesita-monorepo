// Money (MESITA-3306): the waiter's charge on the Pay form. The code field is
// hidden until the guest taps "Waiter gave you a code?"; with a code the
// amount is the charge's, read-only, and the start carries the code, so the
// server pays the waiter's amount and nothing else.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHARGE_REFUSAL } from "@/lib/api/wallet";

// The form lives in its own module since MESITA-3614.
const PAY = readFileSync(join(__dirname, "..", "..", "components", "consumer", "pay", "PayForm.tsx"), "utf8");

describe("the waiter's code on Pay", () => {
  it("draws no code field until the link is tapped", () => {
    expect(PAY).toContain("Waiter gave you a code?");
    expect(PAY).toMatch(/useState\(false\);\s*const \[code, setCode\]/);
    // The bill step (MESITA-3536): no code field with a charge; the field only once opened.
    expect(PAY).toMatch(/\{charge \? null : \(/);
    expect(PAY).toMatch(/\{codeOpen \? \(/);
  });

  it("locks the amount to the charge and sends the code with the start", () => {
    expect(PAY).toMatch(/const cents = charge \? charge\.amount_cents : readAmount\(amount\)/);
    expect(PAY).toMatch(/readOnly=\{charge !== null\}/);
    expect(PAY).toMatch(/\.\.\.\(charge \? \{ charge_code: code \} : \{\}\)/);
  });

  it("has words for locked, taken and gone", () => {
    for (const c of ["locked", "taken", "gone"]) expect(CHARGE_REFUSAL[c]).toBeTruthy();
  });
});
