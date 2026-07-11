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
// every client surface under the (shell) layout: the Profile Class tab, the
// place promo chips, and the place-detail reward box.
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
  /** IG @handle for the connected account. Real handle is persisted on
   *  consumers.instagram_handle (read off the profile); this carries the
   *  demo handle for the Instagram preview state where no profile exists. */
  handle: string | null;
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
  handle: null,
};

function normalize(c: ConsumerClass | null | undefined): ConsumerClassState {
  if (!c) return FREE_CLASS;
  return {
    key: c.key === "premium" ? "premium" : "free",
    origin: c.origin ?? "default",
    renewsAt: c.subscription?.current_period_end ?? c.expires_at ?? null,
    followers: c.followers ?? 0,
    handle: null,
  };
}

const ClassContext = createContext<ConsumerClassState>(FREE_CLASS);

// Client-side mock upgrade. The Premium "Continue to checkout" button sets this
// localStorage flag instead of running Stripe, so the full upgrade UX is
// demoable before consumer-web-create-subscription is live. Remove together
// with the MOCK_SUBSCRIPTION path in subscribe/[classKey] once real billing
// ships.
export const MOCK_PREMIUM_KEY = "mesita:mock-premium";

// (The old MOCK_INSTAGRAM_KEY path is gone — the Verify Instagram sheet now
// calls consumer-web-claim-instagram for a real server-side grant, MESITA-74.)

// Demo/design override. The Me → Class preview toggle writes one of these
// values so every class state is previewable regardless of the real
// server-seeded class — free, Premium via subscription, Premium via Instagram.
// Purely a client-side dev affordance; absent = use the real class. Remove the
// toggle + this key once the three states can be produced with real data.
export const MOCK_CLASS_KEY = "mesita:mock-class";
export type MockClass = "free" | "subscription" | "instagram";
const MOCK_CLASS_VALUES: MockClass[] = ["free", "subscription", "instagram"];

// Follower count shown when the Instagram override is active but no real
// follower reach is seeded — matches VerifySocialSheet's demo value.
const DEMO_INSTAGRAM_FOLLOWERS = 4200;

// Demo @handle shown alongside the demo follower count in the Instagram
// preview state (no real profile is connected there).
const DEMO_INSTAGRAM_HANDLE = "patricio";

// Same-tab + cross-tab notifier for the client-only mock flags. A local
// listener set fires same-tab writes (so the toggle updates the whole shell
// live, no reload); the `storage` event keeps other tabs in sync.
const storeListeners = new Set<() => void>();

function subscribeToStore(onChange: () => void): () => void {
  storeListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    storeListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function notifyStore(): void {
  storeListeners.forEach((l) => l());
}

// SSR-safe localStorage flag read. useSyncExternalStore returns the server
// snapshot (always false) for the hydration render so server and client markup
// match, then swaps in the real localStorage value — no cascading effect render
// and no hydration mismatch.
function useLocalStorageFlag(key: string): boolean {
  return useSyncExternalStore(
    subscribeToStore,
    () => window.localStorage.getItem(key) === "1",
    () => false,
  );
}

function readMockClass(): MockClass | null {
  try {
    const v = window.localStorage.getItem(MOCK_CLASS_KEY);
    return MOCK_CLASS_VALUES.includes(v as MockClass) ? (v as MockClass) : null;
  } catch {
    return null;
  }
}

// Read the current demo override (null when off). SSR snapshot is null so the
// hydration render matches the server-seeded class.
export function useMockClass(): MockClass | null {
  return useSyncExternalStore(subscribeToStore, readMockClass, () => null);
}

// Set (or clear, with null) the demo override and notify every subscriber in
// this tab so the shell re-renders immediately.
export function setMockClass(value: MockClass | null): void {
  try {
    if (value == null) window.localStorage.removeItem(MOCK_CLASS_KEY);
    else window.localStorage.setItem(MOCK_CLASS_KEY, value);
  } catch {
    // best-effort persistence
  }
  notifyStore();
}

function mockClassState(
  mock: MockClass,
  base: ConsumerClassState,
): ConsumerClassState {
  switch (mock) {
    case "free":
      return { ...base, key: "free", origin: "default", renewsAt: null };
    case "instagram":
      return {
        ...base,
        key: "premium",
        origin: "instagram",
        renewsAt: null,
        followers: base.followers > 0 ? base.followers : DEMO_INSTAGRAM_FOLLOWERS,
        handle: base.handle ?? DEMO_INSTAGRAM_HANDLE,
      };
    case "subscription": {
      const renews = new Date();
      renews.setMonth(renews.getMonth() + 1);
      return {
        ...base,
        key: "premium",
        origin: "subscription",
        renewsAt: renews.toISOString(),
      };
    }
  }
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
  const mockClass = useMockClass();

  const value = useMemo<ConsumerClassState>(() => {
    // Demo/design override (Me → Class preview toggle) wins over everything so
    // all three class states are previewable regardless of the real class.
    if (mockClass) return mockClassState(mockClass, base);
    // A real server-seeded Premium always wins — never downgrade or relabel it.
    if (base.key === "premium") return base;
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
  }, [base, mockPremium, mockClass]);

  return (
    <ClassContext.Provider value={value}>{children}</ClassContext.Provider>
  );
}

export function useConsumerClass(): ConsumerClassState {
  return useContext(ClassContext);
}
