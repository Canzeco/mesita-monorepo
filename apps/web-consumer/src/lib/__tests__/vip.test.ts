// MESITA-4766: VIP by invitation code. Money and auth guards only: the code
// the server receives keeps its leading zeros, every redeem answer lands on
// the right state (a lost first try is a success, never "already VIP"), and
// the credit labels still name a returning_vip Back and an old story credit.
import { describe, expect, it } from "vitest";

import { EFError } from "@/lib/api/_invoke";
import { redeemVipResult } from "@/lib/api/vip";
import { entryLabel, ENTRY_LABEL } from "@/lib/api/wallet";
import { creditEntryTitle } from "@/lib/credit-entry-title";
import { KIND_WORD } from "@/lib/ticket-rows";
import { vipCodeDigits, vipRedeemUi } from "@/lib/vip";

const fail = (status: number | null, code: string | null, body: Record<string, unknown> | null = null) =>
  new EFError("x", { fn: "consumer-web-redeem-vip-code", status, code, body });

describe("the invitation code", () => {
  it("keeps leading zeros and drops pasted spaces and dashes", () => {
    expect(vipCodeDigits(" 0012-3456 7890 ")).toBe("001234567890");
    expect(vipCodeDigits("0012 3456 7890 99")).toBe("001234567890");
  });
});

describe("a redeem answer, as the page shows it", () => {
  const ui = (r: ReturnType<typeof redeemVipResult>, after = false) => vipRedeemUi(r, after).kind;

  it("maps every outcome", () => {
    expect(ui(redeemVipResult("joined"))).toBe("joined");
    expect(ui(redeemVipResult("already_vip"))).toBe("already");
    expect(ui(redeemVipResult(null, fail(422, "code_invalid")))).toBe("error");
    expect(ui(redeemVipResult(null, fail(400, "invalid_code_format")))).toBe("error");
    expect(ui(redeemVipResult(null, fail(404, "consumer_not_found")))).toBe("sign_in");
    expect(redeemVipResult(null, fail(429, "too_many_tries", { retryAfterSeconds: 3600 }))).toEqual({ kind: "too_many_tries", retryAfterSeconds: 3600 });
    expect(vipRedeemUi(redeemVipResult(null, fail(429, "too_many_tries"))).text).toBe("Too many tries. Try again in an hour.");
  });

  it("reads network, 5xx and a missing function as the generic error", () => {
    for (const err of [fail(null, null), fail(500, "save_failed"), fail(404, null), new Error("offline")]) {
      expect(vipRedeemUi(redeemVipResult(null, err))).toEqual({ kind: "error", text: "Couldn't check the code. Try again." });
    }
  });

  it("counts already_vip right after a lost try as joined", () => {
    expect(ui(redeemVipResult("already_vip"), true)).toBe("joined");
  });
});

describe("credit labels (MESITA-4766)", () => {
  it("names a Returning VIP Cashback and keeps an old story credit", () => {
    expect(entryLabel({ kind: "cashback", reason: "returning_vip" })).toBe("Cashback · Returning VIP");
    expect(entryLabel({ kind: "cashback", reason: "welcome" })).toBe("Cashback · Welcome");
    expect(ENTRY_LABEL.story).toBe("Instagram Story credit");
    expect(creditEntryTitle("story.123")).toBe("Instagram Story credit");
    expect(KIND_WORD.story).toBe("Instagram Story credit");
  });
});
