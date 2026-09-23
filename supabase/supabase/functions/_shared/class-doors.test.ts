// Run: deno test supabase/functions/_shared/class-doors.test.ts
//
// Locks the door-precedence table for the Diamond List (MESITA-2044): a
// guest is ON the list (invitation → `diamond`) or on the base (`bronze`).
// Followers open nothing — the reach door is closed — and a subscription is
// a PLAN, never a class. The CLASSES fixture below deliberately keeps the old
// follower thresholds so these tests prove the function ignores them even if
// a row is ever re-seeded with one.

import { assertEquals } from "jsr:@std/assert@1";
import { pickEffectiveClass } from "./class-doors.ts";

const CLASSES = [
  { key: "bronze", rank: 0, follower_threshold: null },
  { key: "silver", rank: 1, follower_threshold: 1000 },
  { key: "gold", rank: 2, follower_threshold: null },
  { key: "diamond", rank: 3, follower_threshold: 20000 },
];

function facts(over: {
  followers?: number;
  invitationClassKey?: string | null;
  hasLiveSubscription?: boolean;
}) {
  return {
    classes: CLASSES,
    followers: over.followers ?? 0,
    invitationClassKey: over.invitationClassKey ?? null,
    hasLiveSubscription: over.hasLiveSubscription ?? false,
  };
}

Deno.test("no doors → bronze/default, free plan", () => {
  const eff = pickEffectiveClass(facts({}));
  assertEquals(eff.classKey, "bronze");
  assertEquals(eff.origin, "default");
  assertEquals(eff.plan, "free");
  assertEquals(eff.expiresAt, null);
  assertEquals(eff.doors, { influencer: false, premium: false, aura: false });
});

Deno.test("REACH DOOR CLOSED: 1,000 followers no longer opens silver", () => {
  const eff = pickEffectiveClass(facts({ followers: 1000 }));
  assertEquals(eff.classKey, "bronze");
  assertEquals(eff.origin, "default");
  assertEquals(eff.doors, { influencer: false, premium: false, aura: false });
});

Deno.test("REACH DOOR CLOSED: 20,000 followers does not put a guest on the Diamond List", () => {
  // The self-declared count used to grant diamond outright. Invitation is
  // the only way on.
  for (const followers of [2500, 5000, 20000, 10_000_000]) {
    const eff = pickEffectiveClass(facts({ followers }));
    assertEquals(eff.classKey, "bronze", `${followers} followers`);
    assertEquals(eff.origin, "default");
    assertEquals(eff.doors.influencer, false);
  }
});

Deno.test("followers may be omitted entirely — the recompute no longer reads them", () => {
  const eff = pickEffectiveClass({
    classes: CLASSES,
    invitationClassKey: "diamond",
    hasLiveSubscription: false,
  });
  assertEquals(eff.classKey, "diamond");
  assertEquals(eff.origin, "invitation");
});

Deno.test("live subscription opens the Premium PLAN, not a class", () => {
  const eff = pickEffectiveClass(facts({ hasLiveSubscription: true }));
  assertEquals(eff.classKey, "bronze");
  assertEquals(eff.origin, "default");
  assertEquals(eff.plan, "premium");
  assertEquals(eff.expiresAt, null);
  assertEquals(eff.doors, { influencer: false, premium: true, aura: false });
});

Deno.test("sub + big following → still the base, premium plan", () => {
  const eff = pickEffectiveClass(
    facts({ followers: 50000, hasLiveSubscription: true }),
  );
  assertEquals(eff.classKey, "bronze");
  assertEquals(eff.origin, "default");
  assertEquals(eff.plan, "premium");
});

Deno.test("diamond invitation → on the list; subscription stays a plan", () => {
  const eff = pickEffectiveClass(
    facts({
      followers: 5000,
      invitationClassKey: "diamond",
      hasLiveSubscription: true,
    }),
  );
  assertEquals(eff.classKey, "diamond");
  assertEquals(eff.origin, "invitation");
  assertEquals(eff.plan, "premium");
  assertEquals(eff.expiresAt, null);
  assertEquals(eff.doors, { influencer: false, premium: true, aura: true });
});

Deno.test("invitation revoked → back to the base, whatever the following", () => {
  const eff = pickEffectiveClass(
    facts({ followers: 50000, hasLiveSubscription: true }),
  );
  assertEquals(eff.classKey, "bronze");
  assertEquals(eff.origin, "default");
  assertEquals(eff.plan, "premium");
});

Deno.test("invitation naming an unknown class is ignored", () => {
  const eff = pickEffectiveClass(
    facts({ invitationClassKey: "magnetic", followers: 20000 }),
  );
  assertEquals(eff.classKey, "bronze");
  assertEquals(eff.origin, "default");
  assertEquals(eff.doors.aura, false);
});
