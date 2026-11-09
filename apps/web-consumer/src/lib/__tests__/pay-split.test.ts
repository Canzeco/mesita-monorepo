// Money (MESITA-3305): the Pay form's refusal copy. The split itself is
// paySplit, the sync-shared twin pinned by _shared/pay-split.test.ts on the
// Deno side (MESITA-3457).
import { describe, expect, it } from "vitest";
import { PAY_REFUSAL } from "@/lib/api/wallet";

describe("the refusal copy", () => {
  it("names every code the card part can answer", () => {
    for (const code of ["below_minimum", "no_account", "cards_off", "currency_mismatch", "in_progress", "checkout_failed", "locked"]) {
      expect(PAY_REFUSAL[code], code).toBeTruthy();
    }
  });
});
