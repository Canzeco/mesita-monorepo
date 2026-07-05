"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ConsumerClass } from "@/lib/api/profile";

// Real, server-sourced class for the signed-in consumer, shared with
// every client surface under the (shell) layout: the TopBar class chip, the
// Profile Class tab, the place promo chips, and the place-detail reward box.
//
// Seeded once per request by the layout's consumer-web-get-profile read. This
// replaces the old hardcoded CURRENT_USER mock that pinned everyone to
// Premium — key now reflects the real consumers.class_key, so the instant-
// Premium mock subscription flow becomes visible the moment the post-checkout
// redirect reloads the shell.

export type ConsumerClassState = {
  key: "free" | "premium";
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
const FREE_CLASS: ConsumerClassState = {
  key: "free",
  origin: "default",
  renewsAt: null,
  followers: 0,
};

function normalize(c: ConsumerClass | null | undefined): ConsumerClassState {
  if (!c) return FREE_CLASS;
  return {
    key: c.key === "premium" ? "premium" : "free",
    origin: c.origin ?? "default",
    renewsAt: c.subscription?.current_period_end ?? c.expires_at ?? null,
    followers: c.followers ?? 0,
  };
}

const ClassContext = createContext<ConsumerClassState>(FREE_CLASS);

// Client-side mock upgrade. The Premium "Continue to checkout" button sets this
// localStorage flag instead of running Stripe, so the full upgrade UX is
// demoable before consumer-web-create-subscription is live. Remove together
// with the MOCK_SUBSCRIPTION path in subscribe/[classKey] once real billing
// ships.
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

export function ClassProvider({
  consumerClass,
  children,
}: {
  consumerClass: ConsumerClass | null;
  children: ReactNode;
}) {
  const base = useMemo(() => normalize(consumerClass), [consumerClass]);

  // Client-only mock flags, read SSR-safe so the upgrade UX is demoable. The
  // first (hydration) render sees the server-seeded class; the real
  // localStorage values fold in immediately after.
  const mockPremium = useLocalStorageFlag(MOCK_PREMIUM_KEY);
  const mockInstagram = useLocalStorageFlag(MOCK_INSTAGRAM_KEY);

  const value = useMemo<ConsumerClassState>(() => {
    // A real server-seeded Premium always wins — never downgrade or relabel it.
    if (base.key === "premium") return base;
    // Instagram verification takes precedence over the subscription mock: it's
    // the more specific door (origin + follower reach), and the verify sheet is
    // the only thing that sets it.
    if (mockInstagram) {
      return {
        ...base,
        key: "premium",
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
        key: "premium",
        origin: "subscription",
        renewsAt: renews.toISOString(),
      };
    }
    return base;
  }, [base, mockPremium, mockInstagram]);

  return (
    <ClassContext.Provider value={value}>{children}</ClassContext.Provider>
  );
}

export function useConsumerClass(): ConsumerClassState {
  return useContext(ClassContext);
}
