"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ConsumerMembership } from "@/lib/api/profile";

// Real, server-sourced membership for the signed-in consumer, shared with
// every client surface under the (shell) layout: the TopBar class chip, the
// Profile Plan tab, the venue promo chips, and the venue-detail reward box.
//
// Seeded once per request by the layout's consumer-get-profile read. This
// replaces the old hardcoded CURRENT_USER mock that pinned everyone to
// Premium — tier now reflects the real consumers.tier_key, so the instant-
// Premium mock subscription flow becomes visible the moment the post-checkout
// redirect reloads the shell.

export type Membership = {
  tier: "free" | "premium";
  origin: "default" | "instagram" | "subscription" | "invitation";
  /** Subscription renewal date (ISO). Only meaningful when
   *  origin === "subscription"; null for every other origin. */
  renewsAt: string | null;
  followers: number;
};

// Safe default for any tree rendered without a provider: a plain Free
// account. Nothing is ever gated *open* by this default — the worst case is a
// real Premium member momentarily shown as Free, which the server-seeded
// value corrects on first paint.
const FREE_MEMBERSHIP: Membership = {
  tier: "free",
  origin: "default",
  renewsAt: null,
  followers: 0,
};

function normalize(m: ConsumerMembership | null | undefined): Membership {
  if (!m) return FREE_MEMBERSHIP;
  return {
    tier: m.tier === "premium" ? "premium" : "free",
    origin: m.origin ?? "default",
    renewsAt: m.subscription?.current_period_end ?? m.expires_at ?? null,
    followers: m.followers ?? 0,
  };
}

const MembershipContext = createContext<Membership>(FREE_MEMBERSHIP);

export function MembershipProvider({
  membership,
  children,
}: {
  membership: ConsumerMembership | null;
  children: ReactNode;
}) {
  const value = useMemo(() => normalize(membership), [membership]);
  return (
    <MembershipContext.Provider value={value}>
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembership(): Membership {
  return useContext(MembershipContext);
}
