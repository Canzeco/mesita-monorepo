// Consumer class doors — the ONE recompute behind the class slot (MESITA-972).
//
// THE DIAMOND LIST (MESITA-2044). Pato, 2026-09-22: "there are no classes,
// either you are diamond or you are not. its more like a List. Diamond List."
// A guest is ON the list (class_key `diamond`) or NOT (`bronze`, the base).
// The storage keeps its names — class_key, the metals table, ClassKey — only
// what a person reads changed.
//
// Model: the slot columns on consumers (class_key / class_origin /
// class_granted_at / class_expires_at) are a CACHE of the winning open door.
// Plan is a second axis (`consumers.plan`) and is never a class.
//
//   door           fact                                        origin written
//   ─────────────  ──────────────────────────────────────────  ──────────────
//   invitation     consumers.invitation_class_key              'invitation'
//   base           always open                                 'default'
//
// THE REACH DOOR IS CLOSED. It used to open the highest classes row whose
// follower_threshold the guest's Instagram count cleared (Silver at 1,000,
// Diamond at 20,000) — and that count is self-declared, so the list was not
// invitation-only. Instagram is now a separate fact (verified at 1,000+, the
// Story bonus) that grants NOTHING toward the list, and this module does not
// read follower_threshold at all: migration
// 20260923022245_diamond_list_closes_reach_door.sql nulls the thresholds, and
// ignoring them here means a re-seeded threshold cannot reopen the door.
// `class_origin = 'instagram'` stays a legal stored value (the DB CHECK keeps
// it for old rows); nothing writes it any more.
//
// Subscription opens the Premium PLAN, not a class. Doors never cancel each
// other: an invitation does not touch a running subscription, and cancelling
// the subscription leaves the list alone. Every writer that changes a FACT
// calls recomputeConsumerClass afterwards instead of hand-rolling precedence.
//
// Concurrency: read-facts-then-write-slot is not atomic, but every writer
// recomputes from live facts, so any interleaving is healed by whichever
// recompute runs last. No guard on class_origin is needed — the slot is
// derived state.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { writeConsumer, type ConsumerPatch } from "./consumer-doc.ts";

export type ConsumerDoors = {
  /**
   * The retired reach door. ALWAYS false since MESITA-2044 — followers open
   * nothing. Kept in the shape because consumer-web-get-profile returns
   * `doors` to web-consumer and mobile-consumer, whose types still carry it.
   */
  influencer: false;
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

type ClassRow = {
  key: string;
  rank: number;
  /** Ignored since MESITA-2044 — the reach door is closed. */
  follower_threshold?: number | null;
};

type DoorFacts = {
  classes: ClassRow[];
  /** Ignored since MESITA-2044: followers grant nothing toward the list. */
  followers?: number;
  invitationClassKey: string | null;
  hasLiveSubscription: boolean;
};

/**
 * Pure door arithmetic — pick the effective class from the facts. Exported
 * separately so the precedence table is unit-testable without a DB.
 *
 * Invitation → its key (when it names a live classes row), else the base.
 * Followers and follower_threshold are never read: the reach door is closed.
 */
export function pickEffectiveClass(facts: DoorFacts): EffectiveClass {
  const invited = facts.invitationClassKey != null &&
    facts.classes.some((c) => c.key === facts.invitationClassKey);

  return {
    classKey: invited ? (facts.invitationClassKey as string) : "bronze",
    origin: invited ? "invitation" : "default",
    expiresAt: null,
    plan: facts.hasLiveSubscription ? "premium" : "free",
    doors: {
      influencer: false,
      premium: facts.hasLiveSubscription,
      aura: invited,
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
    .select("key, rank");
  if (classesRes.error) {
    throw new Error(`class_doors_classes: ${classesRes.error.message}`);
  }
  const classes = (classesRes.data ?? []) as ClassRow[];

  const consumerRes = await admin
    .from("consumers")
    .select(
      "id, class_key, class_origin, class_expires_at, plan, invitation_class_key",
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
    .in("state", ["active", "past_due"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subRes.error) {
    throw new Error(`class_doors_subscription: ${subRes.error.message}`);
  }

  const effective = pickEffectiveClass({
    classes,
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
