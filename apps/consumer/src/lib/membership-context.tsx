"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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

// Client-side mock upgrade. The Premium "Continue to checkout" button sets this
// localStorage flag instead of running Stripe, so the full upgrade UX is
// demoable before consumer-create-subscription is live. Remove together with
// the MOCK_SUBSCRIPTION path in subscribe/[tier] once real billing ships.
export const MOCK_PREMIUM_KEY = "mesita:mock-premium";

export function MembershipProvider({
  membership,
  children,
}: {
  membership: ConsumerMembership | null;
  children: ReactNode;
}) {
  const base = useMemo(() => normalize(membership), [membership]);

  // Read the mock flag after mount (localStorage is client-only); the first
  // render matches the server-seeded value, so there's no hydration mismatch.
  const [mockPremium, setMockPremium] = useState(false);
  useEffect(() => {
    setMockPremium(window.localStorage.getItem(MOCK_PREMIUM_KEY) === "1");
  }, []);

  const value = useMemo<Membership>(() => {
    if (!mockPremium || base.tier === "premium") return base;
    const renews = new Date();
    renews.setMonth(renews.getMonth() + 1);
    return {
      ...base,
      tier: "premium",
      origin: "subscription",
      renewsAt: renews.toISOString(),
    };
  }, [base, mockPremium]);

  return (
    <MembershipContext.Provider value={value}>
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembership(): Membership {
  return useContext(MembershipContext);
}
