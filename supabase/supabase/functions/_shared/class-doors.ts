// Consumer class doors — the ONE recompute behind the class slot (MESITA-972).
//
// Model: a consumer can hold several OPEN DOORS at once; the slot columns on
// consumers (class_key / class_origin / class_granted_at / class_expires_at)
// are a CACHE of the highest-ranked open door, never independent state.
//
//   door           fact                                        origin written
//   ─────────────  ──────────────────────────────────────────  ──────────────
//   invitation     consumers.invitation_class_key              'invitation'
//   subscription   live consumer_subscriptions row (Stripe)    'subscription'
//   reach          instagram_followers_count vs the   'instagram'
//                  highest classes.follower_threshold cleared
//   standard       always open                                 'default'
//
// Doors never cancel each other: granting Aura does not touch a running
// subscription, and cancelling the subscription falls back to the next-best
// open door. Every writer that changes a FACT calls recomputeConsumerClass
// afterwards instead of hand-rolling precedence (the old per-writer guards
// disagreed with each other whenever the rank order changed).
//
// Concurrency: read-facts-then-write-slot is not atomic, but every writer
// recomputes from live facts, so any interleaving is healed by whichever
// recompute runs last (and by the next one after that). No guard on
// class_origin is needed — the slot is derived state.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type ConsumerDoors = {
  /** Reach door — the follower count clears a classes.follower_threshold. */
  influencer: boolean;
  /** Paid door — a live (active/past_due) subscription exists. */
  premium: boolean;
  /** Invitation door — admin-granted Aura membership. */
  aura: boolean;
};

export type EffectiveClass = {
  classKey: string;
  origin: "default" | "instagram" | "subscription" | "invitation";
  expiresAt: string | null;
  doors: ConsumerDoors;
};

type ClassRow = { key: string; rank: number; follower_threshold: number | null };

type DoorFacts = {
  classes: ClassRow[];
  followers: number;
  invitationClassKey: string | null;
  /** null = no live subscription. */
  subscriptionPeriodEnd: string | null | undefined;
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
    expiresAt: string | null;
  }> = [];
  // Listed highest-intent first — on an (impossible today) rank tie the
  // earlier entry wins: invitation > subscription > reach > default.
  if (facts.invitationClassKey && rankOf(facts.invitationClassKey) >= 0) {
    candidates.push({
      key: facts.invitationClassKey,
      origin: "invitation",
      expiresAt: null,
    });
  }
  if (facts.hasLiveSubscription) {
    candidates.push({
      key: "premium",
      origin: "subscription",
      expiresAt: facts.subscriptionPeriodEnd ?? null,
    });
  }
  if (reach) {
    candidates.push({ key: reach.key, origin: "instagram", expiresAt: null });
  }
  candidates.push({ key: "standard", origin: "default", expiresAt: null });

  let winner = candidates[0];
  for (const c of candidates) {
    if (rankOf(c.key) > rankOf(winner.key)) winner = c;
  }

  return {
    classKey: winner.key,
    origin: winner.origin,
    expiresAt: winner.expiresAt,
    doors: {
      influencer: reach != null,
      premium: facts.hasLiveSubscription,
      aura: facts.invitationClassKey === "aura",
    },
  };
}

/**
 * Recompute a consumer's effective class from their door facts and persist it
 * to the slot when it changed. Throws on DB errors (webhook callers turn that
 * into a retry; product callers turn it into their own error response).
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
      "id, class_key, class_origin, class_expires_at, instagram_followers_count, invitation_class_key",
    )
    .eq("id", consumerId)
    .maybeSingle();
  if (consumerRes.error) {
    throw new Error(`class_doors_consumer: ${consumerRes.error.message}`);
  }
  const consumer = consumerRes.data;
  if (!consumer) {
    // No row (e.g. profile not created yet) — nothing to write.
    return {
      classKey: "standard",
      origin: "default",
      expiresAt: null,
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
    subscriptionPeriodEnd: subRes.data?.current_period_end as
      | string
      | null
      | undefined,
  });

  const changed = consumer.class_key !== effective.classKey ||
    consumer.class_origin !== effective.origin ||
    (consumer.class_expires_at ?? null) !== effective.expiresAt;
  if (changed) {
    const patch: Record<string, unknown> = {
      class_key: effective.classKey,
      class_origin: effective.origin,
      class_expires_at: effective.expiresAt,
    };
    // Stamp granted_at only when the class identity moves — an expires_at
    // refresh (renewal) is not a new grant.
    if (
      consumer.class_key !== effective.classKey ||
      consumer.class_origin !== effective.origin
    ) {
      patch.class_granted_at = new Date().toISOString();
    }
    const write = await admin
      .from("consumers")
      .update(patch)
      .eq("id", consumerId);
    if (write.error) {
      throw new Error(`class_doors_write: ${write.error.message}`);
    }
  }

  return effective;
}
