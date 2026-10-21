import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// One identity card (Pato, MESITA-2547): Me's top card and Social's person
// card are the same card — picture, name, Instagram — and the phone, which
// is private, lives in Settings, not on the card.
const read = (...p: string[]) =>
  readFileSync(join(__dirname, "../..", ...p), "utf8");
const CARD = read("components", "consumer", "IdentityCard.tsx");
const BAR = read("app", "(shell)", "me", "IdentityBar.tsx");
const FEED = read("components", "consumer", "home", "SocialFeed.tsx");
const SETTINGS = read("components", "consumer", "me", "SettingsModal.tsx");
const PUBLIC = read("components", "consumer", "me", "ShowActivityRow.tsx");

describe("the identity card", () => {
  it("is picture, name and Instagram — never the phone", () => {
    expect(CARD).toContain("data-identity-card");
    expect(CARD).not.toContain("formatPhoneDisplay");
    expect(CARD).not.toContain("<Phone");
  });

  it("is Me's header, with no phone chip", () => {
    expect(BAR).toContain("<IdentityCard");
    expect(BAR).not.toContain("<Phone");
    expect(BAR).not.toContain("formatPhoneDisplay");
  });

  it("is Social's person card, with the handle hidden and no activity", () => {
    expect(FEED).toContain("<IdentityCard");
    expect(FEED).toContain(
      "instagram={instagram ? { label: instagram } : null}",
    );
    expect(FEED).not.toContain("Recent activity");
  });

  it("puts the phone in Settings › Your account", () => {
    expect(SETTINGS).toContain("<PhoneRow />");
  });

  it("calls the Social switch Public profile, on the same stored key", () => {
    expect(PUBLIC).toContain('label="Public profile"');
    expect(PUBLIC).toContain("show_activity");
    expect(PUBLIC).not.toContain('label="Show my activity"');
  });

  // MESITA-2548: photo left; name, Instagram, then Diamond and Plan.
  it("shows Diamond yes or no, and the plan, beside the photo", () => {
    expect(CARD).toContain("data-identity-diamond");
    expect(CARD).toContain("Not Diamond");
    expect(CARD).toContain('{plan === "premium" ? "Premium" : "Free"}');
    expect(CARD).toContain('className="flex w-full items-center gap-4"');
    expect(BAR).toContain("diamond={profile?.diamond === true}");
    expect(FEED).toContain("diamond={person.diamond === true}");
  });
});
