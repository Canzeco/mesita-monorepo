// Run: deno test supabase/functions/_shared/class-doors.test.ts
//
// Locks the door-precedence table after the two-axis cutover: class is a
// metal (bronze < silver < gold < diamond); plan is free | premium. A paying
// subscriber with reach stays Silver by class and Premium by plan — money
// never overwrites a metal.

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

Deno.test("reach below the bar stays bronze", () => {
  const eff = pickEffectiveClass(facts({ followers: 999 }));
  assertEquals(eff.classKey, "bronze");
  assertEquals(eff.doors.influencer, false);
});

Deno.test("reach ≥ 1,000 → silver/instagram", () => {
  const eff = pickEffectiveClass(facts({ followers: 1000 }));
  assertEquals(eff.classKey, "silver");
  assertEquals(eff.origin, "instagram");
  assertEquals(eff.plan, "free");
  assertEquals(eff.doors, { influencer: true, premium: false, aura: false });
});

Deno.test("live subscription opens the Premium PLAN, not a class", () => {
  const eff = pickEffectiveClass(facts({ hasLiveSubscription: true }));
  assertEquals(eff.classKey, "bronze");
  assertEquals(eff.origin, "default");
  assertEquals(eff.plan, "premium");
  assertEquals(eff.expiresAt, null);
  assertEquals(eff.doors.premium, true);
});

Deno.test("REGRESSION sub + reach → silver class + premium plan", () => {
  const eff = pickEffectiveClass(
    facts({
      followers: 5000,
      hasLiveSubscription: true,
    }),
  );
  assertEquals(eff.classKey, "silver");
  assertEquals(eff.origin, "instagram");
  assertEquals(eff.plan, "premium");
  assertEquals(eff.doors, { influencer: true, premium: true, aura: false });
});

Deno.test("diamond invitation beats reach; subscription stays a plan", () => {
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
  assertEquals(eff.doors, { influencer: true, premium: true, aura: true });
});

Deno.test("invitation revoked with live sub + reach → silver, plan still premium", () => {
  const eff = pickEffectiveClass(
    facts({ followers: 5000, hasLiveSubscription: true }),
  );
  assertEquals(eff.classKey, "silver");
  assertEquals(eff.plan, "premium");
});

Deno.test("sub lapse with reach still open → silver, not bronze", () => {
  const eff = pickEffectiveClass(facts({ followers: 2500 }));
  assertEquals(eff.classKey, "silver");
  assertEquals(eff.origin, "instagram");
  assertEquals(eff.plan, "free");
});

Deno.test("invitation naming an unknown class is ignored", () => {
  const eff = pickEffectiveClass(
    facts({ invitationClassKey: "magnetic", followers: 2000 }),
  );
  assertEquals(eff.classKey, "silver");
  assertEquals(eff.doors.aura, false);
});

Deno.test("reach ≥ 20,000 → diamond", () => {
  const eff = pickEffectiveClass(facts({ followers: 20000 }));
  assertEquals(eff.classKey, "diamond");
  assertEquals(eff.origin, "instagram");
});
