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

// MESITA-2604 (Pato: "remove the > from the name … for the other fields
// neither include >"): the four boxes draw no chevron, doors or facts.
describe("the identity boxes", () => {
  it("draw no chevron", () => {
    expect(CARD).not.toContain("ChevronRight");
  });
});
