// Consumer class doors — the ONE recompute behind the class slot (MESITA-972).
//
// Model: a consumer can hold several OPEN DOORS at once; the slot columns on
// consumers (class_key / class_origin / class_granted_at / class_expires_at)
// are a CACHE of the highest-ranked open CLASS door. Plan is a second axis
// (`consumers.plan`) and is never a class.
//
//   door           fact                                        origin written
//   ─────────────  ──────────────────────────────────────────  ──────────────
//   invitation     consumers.invitation_class_key              'invitation'
//   reach          instagram_followers_count vs the            'instagram'
//                  highest classes.follower_threshold cleared
//   bronze         always open                                 'default'
//
// Subscription opens the Premium PLAN, not a class. Doors never cancel each
// other: granting Diamond does not touch a running subscription, and
// cancelling the subscription leaves the metal the guest earned. Every writer
// that changes a FACT calls recomputeConsumerClass afterwards instead of
// hand-rolling precedence.
//
// Concurrency: read-facts-then-write-slot is not atomic, but every writer
// recomputes from live facts, so any interleaving is healed by whichever
// recompute runs last. No guard on class_origin is needed — the slot is
// derived state.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { writeConsumer, type ConsumerPatch } from "./consumer-doc.ts";

export type ConsumerDoors = {
  /** Reach door — the follower count clears a classes.follower_threshold. */
  influencer: boolean;
  /** Paid door — a live (active/past_due) subscription exists. Plan, not class. */
  premium: boolean;
  /** Invitation door — an invitation_class_key is set to a live metal. */
  aura: boolean;
};

export type EffectiveClass = {
  classKey: string;
  origin: "default" | "instagram" | "invitation";
  expiresAt: null;
  plan: "free" | "premium";
  doors: ConsumerDoors;
};

type ClassRow = { key: string; rank: number; follower_threshold: number | null };

type DoorFacts = {
  classes: ClassRow[];
  followers: number;
  invitationClassKey: string | null;
  hasLiveSubscription: boolean;
};

/**
 * Pure door arithmetic — pick the effective class from the facts. Exported
 * separately so the precedence table is unit-testable without a DB.
 */
export function pickEffectiveClass(facts: DoorFacts): EffectiveClass {
  const rankOf = (key: string | null): number =>
    facts.classes.find((c) => c.key === key)?.rank ?? -1;

  // Reach door: highest-ranked classes row whose threshold the count clears.
  const reach =
    facts.classes
      .filter((c) => c.follower_threshold != null)
      .sort((a, b) => b.rank - a.rank)
      .find((c) => facts.followers >= (c.follower_threshold as number)) ?? null;

  const candidates: Array<{
    key: string;
    origin: EffectiveClass["origin"];
  }> = [];
  // Highest-intent first on a rank tie: invitation > reach > default.
  if (facts.invitationClassKey && rankOf(facts.invitationClassKey) >= 0) {
    candidates.push({
      key: facts.invitationClassKey,
      origin: "invitation",
    });
  }
  if (reach) {
    candidates.push({ key: reach.key, origin: "instagram" });
  }
  candidates.push({ key: "bronze", origin: "default" });

  let winner = candidates[0];
  for (const c of candidates) {
    if (rankOf(c.key) > rankOf(winner.key)) winner = c;
  }

  return {
    classKey: winner.key,
    origin: winner.origin,
    expiresAt: null,
    plan: facts.hasLiveSubscription ? "premium" : "free",
    doors: {
      influencer: reach != null,
      premium: facts.hasLiveSubscription,
      aura: facts.invitationClassKey != null &&
        rankOf(facts.invitationClassKey) >= 0,
    },
  };
}

/**
 * Recompute a consumer's effective class and plan from their door facts and
 * persist the slot when it changed. Throws on DB errors (webhook callers
 * turn that into a retry; product callers turn it into their own error
 * response).
 */
export async function recomputeConsumerClass(
  admin: SupabaseClient,
  consumerId: string,
): Promise<EffectiveClass> {
  const classesRes = await admin
    .from("classes")
    .select("key, rank, follower_threshold");
  if (classesRes.error) {
    throw new Error(`class_doors_classes: ${classesRes.error.message}`);
  }
  const classes = (classesRes.data ?? []) as ClassRow[];

  const consumerRes = await admin
    .from("consumers")
    .select(
      "id, class_key, class_origin, class_expires_at, plan, instagram_followers_count, invitation_class_key",
    )
    .eq("id", consumerId)
    .maybeSingle();
  if (consumerRes.error) {
    throw new Error(`class_doors_consumer: ${consumerRes.error.message}`);
  }
  const consumer = consumerRes.data;
  if (!consumer) {
    return {
      classKey: "bronze",
      origin: "default",
      expiresAt: null,
      plan: "free",
      doors: { influencer: false, premium: false, aura: false },
    };
  }

  const subRes = await admin
    .from("consumer_subscriptions")
    .select("current_period_end")
    .eq("consumer_id", consumerId)
    .in("status", ["active", "past_due"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subRes.error) {
    throw new Error(`class_doors_subscription: ${subRes.error.message}`);
  }

  const effective = pickEffectiveClass({
    classes,
    followers: (consumer.instagram_followers_count as number) ?? 0,
    invitationClassKey: (consumer.invitation_class_key as string) ?? null,
    hasLiveSubscription: subRes.data != null,
  });

  const changed = consumer.class_key !== effective.classKey ||
    consumer.class_origin !== effective.origin ||
    (consumer.class_expires_at ?? null) !== effective.expiresAt ||
    (consumer.plan ?? "free") !== effective.plan;
  if (changed) {
    const patch: ConsumerPatch = {
      class_key: effective.classKey,
      class_origin: effective.origin,
      class_expires_at: null,
      plan: effective.plan,
    };
    if (
      consumer.class_key !== effective.classKey ||
      consumer.class_origin !== effective.origin
    ) {
      patch.class_granted_at = new Date().toISOString();
    }
    const write = await writeConsumer(admin, {
      mode: "update",
      id: consumerId,
      patch,
    });
    if (!write.ok) {
      throw new Error(`class_doors_write: ${write.error}`);
    }
  }

  return effective;
}
