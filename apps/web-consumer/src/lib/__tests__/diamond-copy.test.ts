// DIAMOND, AND NO LADDER (Pato, MESITA-2044: "there are no classes, either
// you are diamond or you are not"; MESITA-2046: "Don't call diamond list, just
// diamond").
//
// A string-scan over every guest-facing module that used to name a rung. It
// strips comments first — comments may tell the ladder's history — and then
// fails on any metal, on VIP, and on the retired "Diamond List".
// Rendering each screen would be the stronger proof, but half of these need a
// router, a Supabase client and a ticket row to mount; a retired word in their
// SOURCE is the regression, and this catches it wherever it hides.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CLASSES,
  CLASS_ORDER,
  identityForClassKey,
} from "@/lib/consumer-data";
import {
  DIAMOND,
  DIAMOND_ES,
  DIAMOND_HELP_LINE,
  DIAMOND_MEMBER_NUMBER_LINE,
  DIAMOND_PIN_SUBTITLE,
  DIAMOND_PIN_SUCCESS,
  DIAMOND_REQUEST_BODY,
} from "@/lib/consumer-identity";
import { REWARD_SEGMENTS } from "@/lib/reward-segments";

const SRC = join(__dirname, "..", "..");

const GUEST_FACING = [
  "app/(shell)/me/IdentityBar.tsx",
  "app/(shell)/me/ProfileClient.tsx",
  "components/consumer/me/DiamondModal.tsx",
  "components/consumer/me/InvitePinModal.tsx",
  "components/consumer/me/HelpModal.tsx",
  "components/consumer/me/PlanModal.tsx",
  "components/consumer/me/AiConnectModal.tsx",
  "components/consumer/me/demo/DiamondEmulator.tsx",
  "components/consumer/EditProfileSheet.tsx",
  "components/consumer/ReviewCard.tsx",
  "components/consumer/home/SocialProfileModal.tsx",
  "components/consumer/place-detail/reward-matrix.tsx",
  "components/consumer/place-detail/rewards.tsx",
  "components/consumer/rewards/TicketScreen.tsx",
  "components/consumer/rewards/ticket-steps.tsx",
  "components/auth/EnterpriseAuthLayout.tsx",
  "lib/consumer-identity.ts",
];

function code(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("no guest-facing module names a rung", () => {
  it.each(GUEST_FACING)("%s", (rel) => {
    const src = code(rel);
    // Capitalised on purpose: `bronze`/`diamond` are storage keys the code
    // still switches on, and `bg-tier-*` is a CSS token, not copy.
    expect(src).not.toMatch(/\b(Bronze|Silver|Gold|VIP)\b/);
    // The retired name (MESITA-2046): "Diamond", one word, never a list.
    expect(src).not.toMatch(/Diamond List|Lista Diamante|\bthe list\b/i);
    expect(src).not.toMatch(/\b(climb|rank up|unlock a higher)\b/i);
  });
});

describe("the storage bridge still parses a stray metal as 'not Diamond'", () => {
  it.each(["silver", "gold", "influencer", "standard", "premium", "bronze", null])(
    "%s -> bronze",
    (key) => {
      expect(identityForClassKey(key).cls).toBe("bronze");
    },
  );

  it("diamond and the legacy aura key are Diamond", () => {
    expect(identityForClassKey("diamond").cls).toBe("diamond");
    expect(identityForClassKey("aura").cls).toBe("diamond");
  });

  it("the display rows are exactly Base and Diamond", () => {
    expect(CLASS_ORDER).toEqual(["bronze", "diamond"]);
    expect(CLASSES.map((c) => c.label)).toEqual(["Base", "Diamond"]);
    const identity = REWARD_SEGMENTS.filter((s) => s.kind === "class");
    expect(identity.map((s) => s.name)).toEqual(["Base", "Diamond"]);
    expect(identity.map((s) => s.nameEs)).toEqual(["Base", "Diamante"]);
  });
});

describe("the copy the mobile twin mirrors, character for character", () => {
  it("names", () => {
    expect(DIAMOND).toBe("Diamond");
    expect(DIAMOND_ES).toBe("Diamante");
  });

  it("lines", () => {
    expect(DIAMOND_REQUEST_BODY).toBe(
      "Hi Mesita — I'd like to join Diamond.\n\nWho I am:\n",
    );
    expect(DIAMOND_PIN_SUBTITLE).toBe(
      "Ten digits. It makes you Diamond.",
    );
    expect(DIAMOND_PIN_SUCCESS).toBe("You're Diamond.");
    expect(DIAMOND_MEMBER_NUMBER_LINE).toBe(
      "Give this number when you ask to join Diamond.",
    );
    expect(DIAMOND_HELP_LINE).toBe(
      "Every guest gets the base discount. Diamond guests get more — Diamond is invitation-only, and you can ask to join from Me.",
    );
  });
});
