"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ConsumerClass } from "@/lib/api/profile";
import {
  DEMO_INSTAGRAM_FOLLOWERS,
  DEMO_INSTAGRAM_HANDLE,
} from "@/lib/instagram-demo";
import { INFLUENCER_FOLLOWER_THRESHOLD } from "@/lib/consumer-data";

// Real, server-sourced class for the signed-in consumer, shared with
// every client surface under the (shell) layout: the Profile Class tab, the
// place promo chips, and the place-detail reward box.
//
// Seeded once per request by the layout's consumer-web-get-profile read. This
// replaces the old hardcoded CURRENT_USER mock that pinned everyone to
// Premium — key now reflects the real consumers.class_key, so the instant-
// Premium mock subscription flow becomes visible the moment the post-checkout
// redirect reloads the shell.

type ConsumerClassState = {
  key: "standard" | "premium" | "influencer" | "aura";
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

// Safe default for any tree rendered without a provider: a plain Standard
// account. Nothing is ever gated *open* by this default — the worst case is a
// real elevated member momentarily shown as Standard, which the server-seeded
// value corrects on first paint.
const STANDARD_CLASS: ConsumerClassState = {
  key: "standard",
  origin: "default",
  renewsAt: null,
  followers: 0,
  handle: null,
};

// The known class keys — an unknown/stale server key (e.g. the retired
// "magnetic") renders as Standard instead of crashing a Record lookup.
const KNOWN_CLASS_KEYS = new Set(["standard", "premium", "influencer", "aura"]);

function normalize(c: ConsumerClass | null | undefined): ConsumerClassState {
  if (!c) return STANDARD_CLASS;
  return {
    key: KNOWN_CLASS_KEYS.has(c.key) ? c.key : "standard",
    origin: c.origin ?? "default",
    renewsAt: c.subscription?.current_period_end ?? c.expires_at ?? null,
    followers: c.followers ?? 0,
    handle: null,
  };
}

const ClassContext = createContext<ConsumerClassState>(STANDARD_CLASS);

// Client-side mock upgrade. The Premium "Continue to checkout" button sets this
// localStorage flag instead of running Stripe, so the full upgrade UX is
// demoable before consumer-web-create-subscription is live. Remove together
// with the MOCK_SUBSCRIPTION path in subscribe/[classKey] once real billing
// ships.
export const MOCK_PREMIUM_KEY = "mesita:mock-premium";

// (The old MOCK_INSTAGRAM_KEY path is gone — the Verify Instagram sheet now
// calls consumer-web-claim-instagram for a real server-side grant, MESITA-74.)

// Demo/design override. The Me-page demo toggles write this JSON blob so
// every account state is previewable regardless of the real server-seeded
// class. Two independent axes, mirroring the real model:
//   • class     — forced class ("standard" down-previews a real elevated
//                 account; premium = via subscription, aura = via
//                 invitation, influencer = via Instagram). null = real class.
//   • instagram — a connected Instagram (handle + follower reach). Crossing
//                 INFLUENCER_FOLLOWER_THRESHOLD grants Influencer via
//                 Instagram — exactly like a qualifying
//                 consumer-web-claim-instagram claim writes the class.
// Purely a client-side dev affordance; absent = the real account. Remove the
// toggles + this key once the states can be produced with real data.
const MOCK_ACCOUNT_KEY = "mesita:mock-account";
export type MockAccount = {
  class: "standard" | "premium" | "influencer" | "aura" | null;
  instagram: boolean;
  followers: number;
};

const MOCK_ACCOUNT_OFF: MockAccount = {
  class: null,
  instagram: false,
  followers: DEMO_INSTAGRAM_FOLLOWERS,
};

// Demo IG followers/handle: see @/lib/instagram-demo.

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

// Parse + validate the stored blob. The snapshot is CACHED on the raw string:
// useSyncExternalStore compares snapshots by reference, so parsing fresh on
// every read would loop forever.
let mockAccountRaw: string | null = null;
let mockAccountCache: MockAccount | null = null;

function parseMockAccount(raw: string | null): MockAccount | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<MockAccount>;
    const cls =
      v.class === "standard" ||
      v.class === "premium" ||
      v.class === "influencer" ||
      v.class === "aura"
        ? v.class
        : null;
    const instagram = v.instagram === true;
    if (cls == null && !instagram) return null; // nothing overridden
    const followers =
      typeof v.followers === "number" &&
      Number.isFinite(v.followers) &&
      v.followers >= 0
        ? Math.trunc(v.followers)
        : DEMO_INSTAGRAM_FOLLOWERS;
    return { class: cls, instagram, followers };
  } catch {
    return null;
  }
}

function readMockAccount(): MockAccount | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(MOCK_ACCOUNT_KEY);
  } catch {
    raw = null;
  }
  if (raw !== mockAccountRaw) {
    mockAccountRaw = raw;
    mockAccountCache = parseMockAccount(raw);
  }
  return mockAccountCache;
}

// Read the current demo override (null when off). SSR snapshot is null so the
// hydration render matches the server-seeded class.
export function useMockAccount(): MockAccount | null {
  return useSyncExternalStore(subscribeToStore, readMockAccount, () => null);
}

// Merge a patch into the demo override (or clear it entirely with null) and
// notify every subscriber in this tab so the shell re-renders immediately.
// A patch that lands on "nothing overridden" clears the key.
export function setMockAccount(patch: Partial<MockAccount> | null): void {
  try {
    if (patch == null) {
      window.localStorage.removeItem(MOCK_ACCOUNT_KEY);
    } else {
      const next = { ...(readMockAccount() ?? MOCK_ACCOUNT_OFF), ...patch };
      if (next.class == null && !next.instagram) {
        window.localStorage.removeItem(MOCK_ACCOUNT_KEY);
      } else {
        window.localStorage.setItem(MOCK_ACCOUNT_KEY, JSON.stringify(next));
      }
    }
  } catch {
    // best-effort persistence
  }
  notifyStore();
}

function mockAccountState(
  mock: MockAccount,
  base: ConsumerClassState,
): ConsumerClassState {
  // Instagram reach wins over the class axis (except an explicit Aura
  // preview — invitation outranks the reach door), exactly like a qualifying
  // consumer-web-claim-instagram claim writes class_key server-side but never
  // clobbers a higher-ranked invitation class.
  const igInfluencer =
    mock.instagram &&
    mock.followers >= INFLUENCER_FOLLOWER_THRESHOLD &&
    mock.class !== "aura";

  let key: ConsumerClassState["key"];
  let origin: ConsumerClassState["origin"];
  let renewsAt: string | null;
  if (igInfluencer) {
    key = "influencer";
    origin = "instagram";
    renewsAt = null;
  } else if (mock.class === "premium") {
    const renews = new Date();
    renews.setMonth(renews.getMonth() + 1);
    key = "premium";
    origin = "subscription";
    renewsAt = renews.toISOString();
  } else if (mock.class === "aura") {
    // The invite-only presence class — the manual-invitation door.
    key = "aura";
    origin = "invitation";
    renewsAt = null;
  } else if (mock.class === "influencer") {
    // Influencer preview without the IG axis on — still the reach door.
    key = "influencer";
    origin = "instagram";
    renewsAt = null;
  } else if (mock.class === "standard") {
    key = "standard";
    origin = "default";
    renewsAt = null;
  } else {
    // No class override — the real class shows through the IG emulation.
    ({ key, origin, renewsAt } = base);
  }

  return {
    key,
    origin,
    renewsAt,
    followers: mock.instagram ? mock.followers : base.followers,
    handle: mock.instagram ? (base.handle ?? DEMO_INSTAGRAM_HANDLE) : base.handle,
  };
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
  const mockAccount = useMockAccount();

  const value = useMemo<ConsumerClassState>(() => {
    // Demo/design override (Me-page demo toggles) wins over everything so
    // every account state is previewable regardless of the real class.
    if (mockAccount) return mockAccountState(mockAccount, base);
    // A real server-seeded elevated class always wins — never downgrade or
    // relabel it.
    if (base.key !== "standard") return base;
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
  }, [base, mockPremium, mockAccount]);

  return (
    <ClassContext.Provider value={value}>{children}</ClassContext.Provider>
  );
}

export function useConsumerClass(): ConsumerClassState {
  return useContext(ClassContext);
}
