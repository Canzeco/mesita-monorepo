// Run: deno test supabase/functions/_shared/class-doors.test.ts
//
// Locks the door-precedence table (MESITA-972): effective class = the
// highest-ranked OPEN door under the canonical ladder standard(0) <
// influencer(1) < premium(2) < aura(3). The sub+reach case is the regression
// that motivated the rank flip — a paying subscriber with 2,000+ followers
// must stay Premium (+10 step), never get demoted onto Influencer (+5).

import { assertEquals } from "jsr:@std/assert@1";
import { pickEffectiveClass } from "./class-doors.ts";

const CLASSES = [
  { key: "standard", rank: 0, follower_threshold: null },
  { key: "influencer", rank: 1, follower_threshold: 2000 },
  { key: "premium", rank: 2, follower_threshold: null },
  { key: "aura", rank: 3, follower_threshold: null },
];

function facts(over: {
  followers?: number;
  invitationClassKey?: string | null;
  hasLiveSubscription?: boolean;
  subscriptionPeriodEnd?: string | null;
}) {
  return {
    classes: CLASSES,
    followers: over.followers ?? 0,
    invitationClassKey: over.invitationClassKey ?? null,
    hasLiveSubscription: over.hasLiveSubscription ?? false,
    subscriptionPeriodEnd: over.subscriptionPeriodEnd ?? null,
  };
}

Deno.test("no doors → standard/default", () => {
  const eff = pickEffectiveClass(facts({}));
  assertEquals(eff.classKey, "standard");
  assertEquals(eff.origin, "default");
  assertEquals(eff.doors, { influencer: false, premium: false, aura: false });
});

Deno.test("reach below the bar stays standard", () => {
  const eff = pickEffectiveClass(facts({ followers: 1999 }));
  assertEquals(eff.classKey, "standard");
  assertEquals(eff.doors.influencer, false);
});

Deno.test("reach ≥ 2,000 → influencer/instagram", () => {
  const eff = pickEffectiveClass(facts({ followers: 2000 }));
  assertEquals(eff.classKey, "influencer");
  assertEquals(eff.origin, "instagram");
  assertEquals(eff.doors, { influencer: true, premium: false, aura: false });
});

Deno.test("live subscription → premium with period end", () => {
  const eff = pickEffectiveClass(
    facts({ hasLiveSubscription: true, subscriptionPeriodEnd: "2026-09-01" }),
  );
  assertEquals(eff.classKey, "premium");
  assertEquals(eff.origin, "subscription");
  assertEquals(eff.expiresAt, "2026-09-01");
});

Deno.test("REGRESSION sub + reach → premium wins (paying beats +5)", () => {
  const eff = pickEffectiveClass(
    facts({
      followers: 5000,
      hasLiveSubscription: true,
      subscriptionPeriodEnd: "2026-09-01",
    }),
  );
  assertEquals(eff.classKey, "premium");
  assertEquals(eff.origin, "subscription");
  // Both doors stay visibly open — the slot is a max, not a merge.
  assertEquals(eff.doors, { influencer: true, premium: true, aura: false });
});

Deno.test("aura invitation beats everything, subscription untouched", () => {
  const eff = pickEffectiveClass(
    facts({
      followers: 5000,
      invitationClassKey: "aura",
      hasLiveSubscription: true,
      subscriptionPeriodEnd: "2026-09-01",
    }),
  );
  assertEquals(eff.classKey, "aura");
  assertEquals(eff.origin, "invitation");
  // Aura is not a subscription — no expiry on the slot.
  assertEquals(eff.expiresAt, null);
  assertEquals(eff.doors, { influencer: true, premium: true, aura: true });
});

Deno.test("aura revoked with live sub + reach → falls back to premium", () => {
  const eff = pickEffectiveClass(
    facts({ followers: 5000, hasLiveSubscription: true }),
  );
  assertEquals(eff.classKey, "premium");
});

Deno.test("sub lapse with reach still open → influencer, not standard", () => {
  const eff = pickEffectiveClass(facts({ followers: 2500 }));
  assertEquals(eff.classKey, "influencer");
  assertEquals(eff.origin, "instagram");
});

Deno.test("invitation naming an unknown class is ignored", () => {
  const eff = pickEffectiveClass(
    facts({ invitationClassKey: "magnetic", followers: 2000 }),
  );
  assertEquals(eff.classKey, "influencer");
  assertEquals(eff.doors.aura, false);
});
