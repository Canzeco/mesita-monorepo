"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ConsumerMembership } from "@/lib/api/profile";

// Real, server-sourced membership for the signed-in consumer, shared with
// every client surface under the (shell) layout: the TopBar class chip, the
// Profile Plan tab, the place promo chips, and the place-detail reward box.
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

// Client-side mock Instagram verification. The Verify Instagram sheet sets this
// flag instead of calling a real social-graph check, so the "connect Instagram
// → instant Premium" door is demoable before the verification backend ships.
// Premium sourced this way reports origin === "instagram" with a follower count
// safely above the 1,000 threshold. Remove with the sheet's mock once the real
// verify flow lands.
export const MOCK_INSTAGRAM_KEY = "mesita:mock-instagram";

// Mocked follower reach reported once Instagram is "connected" — comfortably
// past the premium followerThreshold (1,000) so the unlocked perk reads true.
const MOCK_INSTAGRAM_FOLLOWERS = 4200;

// SSR-safe localStorage flag read. useSyncExternalStore returns the server
// snapshot (always false) for the hydration render so server and client markup
// match, then swaps in the real localStorage value — no cascading effect render
// and no hydration mismatch. The `storage` subscription keeps other tabs in
// sync; the mock flows full-navigate after writing, so the new load reads fresh
// regardless.
function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function useLocalStorageFlag(key: string): boolean {
  return useSyncExternalStore(
    subscribeToStorage,
    () => window.localStorage.getItem(key) === "1",
    () => false,
  );
}

export function MembershipProvider({
  membership,
  children,
}: {
  membership: ConsumerMembership | null;
  children: ReactNode;
}) {
  const base = useMemo(() => normalize(membership), [membership]);

  // Client-only mock flags, read SSR-safe so the upgrade UX is demoable. The
  // first (hydration) render sees the server-seeded membership; the real
  // localStorage values fold in immediately after.
  const mockPremium = useLocalStorageFlag(MOCK_PREMIUM_KEY);
  const mockInstagram = useLocalStorageFlag(MOCK_INSTAGRAM_KEY);

  const value = useMemo<Membership>(() => {
    // A real server-seeded Premium always wins — never downgrade or relabel it.
    if (base.tier === "premium") return base;
    // Instagram verification takes precedence over the subscription mock: it's
    // the more specific door (origin + follower reach), and the verify sheet is
    // the only thing that sets it.
    if (mockInstagram) {
      return {
        ...base,
        tier: "premium",
        origin: "instagram",
        renewsAt: null,
        followers: MOCK_INSTAGRAM_FOLLOWERS,
      };
    }
    if (mockPremium) {
      const renews = new Date();
      renews.setMonth(renews.getMonth() + 1);
      return {
        ...base,
        tier: "premium",
        origin: "subscription",
        renewsAt: renews.toISOString(),
      };
    }
    return base;
  }, [base, mockPremium, mockInstagram]);

  return (
    <MembershipContext.Provider value={value}>
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembership(): Membership {
  return useContext(MembershipContext);
}
