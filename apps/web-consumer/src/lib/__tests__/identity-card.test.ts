// MVP test rule (MESITA-2600): only the auth guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// One identity card (Pato, MESITA-2547): Me's top card and Social's person
// card are the same card — picture, name, Instagram — and the phone, which
// is private, lives in Settings, not on the card.
const read = (...p: string[]) =>
  readFileSync(join(__dirname, "../..", ...p), "utf8");
const CARD = read("components", "consumer", "IdentityCard.tsx");

describe("the identity card", () => {
  it("is picture, name and Instagram — never the phone", () => {
    expect(CARD).toContain("data-identity-card");
    expect(CARD).not.toContain("formatPhoneDisplay");
    expect(CARD).not.toContain("<Phone");
  });
});

describe("Me's Plan tile", () => {
  const ME = read("app", "(shell)", "me", "ProfileClient.tsx").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  it("names the guest's real plan, never a hardcoded Free (MESITA-2553)", () => {
    expect(ME).toContain(
      'summary={loading ? null : profile ? PLAN_LABEL[toGuestPlan(profile.plan)] : "…"}',
    );
    expect(ME).not.toContain('summary="Free"');
  });
});
