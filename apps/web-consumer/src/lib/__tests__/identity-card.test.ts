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

  it("is Social's person card, with the handle hidden and no activity feed", () => {
    expect(FEED).toContain("<IdentityCard");
    expect(FEED).toContain(
      "instagram={instagram ? { label: instagram } : null}",
    );
    expect(FEED).not.toContain("Recent activity");
  });

  it("puts the phone in Settings › Your account", () => {
    expect(SETTINGS).toContain("<PhoneRow />");
  });

  // MESITA-2552: connecting Instagram means you show in Social, always.
  it("has no Public profile switch", () => {
    expect(SETTINGS).not.toContain("ShowActivityRow");
    expect(SETTINGS).not.toContain("Public profile");
    expect(SETTINGS).not.toContain('title="Privacy"');
  });

  // MESITA-2595: photo, name, then one fact per line — Instagram, Class,
  // Plan. Plan is back on the card (it left in MESITA-2576).
  it("gets Class and Plan from the profile on Me, both as doors", () => {
    // Centred: photo on top, name, then the chips (MESITA-2592).
    expect(CARD).toContain(
      'className="flex w-full flex-col items-center gap-2 text-center"',
    );
    expect(CARD).toContain("flex max-w-full flex-col items-center gap-1.5");
    expect(BAR).toContain("guestClass={guestClass}");
    expect(BAR).toContain("onClassPress=");
    expect(BAR).toContain("<ClassSheet");
    expect(BAR).toContain("planHref={CONSUMER_ROUTES.mePages.plan}");
    expect(CARD).toContain("PLAN_LABEL[plan]");
  });

  it("shows Class and Plan on Social as plain facts, never doors", () => {
    expect(FEED).toContain("guestClass={toGuestClass(person.guestClass)}");
    expect(FEED).toContain("plan={toGuestPlan(person.plan)}");
    expect(FEED).not.toContain("onClassPress");
    expect(FEED).not.toContain("planHref");
  });

  // Pato, MESITA-2574: "the header must be white and smaller shorter".
  it("Me's header is a short full-width white app bar on the tiles' edge", () => {
    // MESITA-2582: an app bar, not a card (MESITA-2577's inset card read as
    // one more tile); content on the grid's own px-4.
    expect(BAR).toContain('className="border-border bg-card relative shrink-0 border-b"');
    expect(BAR).toContain('className="relative flex flex-col items-center px-4 py-3"');
    expect(BAR).not.toContain("rounded-2xl");
    expect(BAR).not.toContain("shadow-rest");
    expect(read("app", "(shell)", "me", "ProfileClient.tsx")).toContain(
      "overflow-y-auto px-4 pt-3 pb-8",
    );
    expect(BAR).not.toContain("bg-border h-2.5");
    expect(BAR).not.toContain("bg-background/95");
    expect(CARD).toContain("h-16 w-16");
    expect(CARD).not.toContain("h-20 w-20");
    // Me's Instagram chip carries the follower count once connected.
    expect(BAR).toContain("instagramWithFollowers(");
  });
});

// The gem is the class chip's shape alone (Pato, MESITA-2551: "FOR PLAN
// DON'T USE THE … DIAMOND ICON. ITS CONFUSING").
describe("Me's Plan tile", () => {
  const ME = read("app", "(shell)", "me", "ProfileClient.tsx").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  it("wears a card, never the gem", () => {
    const tile = ME.slice(ME.lastIndexOf("<DestTile", ME.indexOf('title="Plan"')), ME.indexOf('title="Plan"'));
    expect(tile).toContain("Icon={CreditCard}");
    expect(ME).not.toMatch(/\bGem\b/);
  });

  it("names the guest's real plan, never a hardcoded Free (MESITA-2553)", () => {
    expect(ME).toContain('summary={profile ? PLAN_LABEL[toGuestPlan(profile.plan)] : "…"}');
    expect(ME).not.toContain('summary="Free"');
  });
});
