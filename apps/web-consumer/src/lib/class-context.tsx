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
import {
  CLASS_ORDER,
  INFLUENCER_FOLLOWER_THRESHOLD,
  type ClassKey,
} from "@/lib/consumer-data";

// Real, server-sourced class for the signed-in consumer, shared with
// every client surface under the (shell) layout: the Profile Class tab, the
// place promo chips, and the place-detail reward box.
//
// Seeded once per request by the layout's consumer-web-get-profile read. This
// replaces the old hardcoded CURRENT_USER mock that pinned everyone to
// Premium — key now reflects the real consumers.class_key from the profile EF.

/** Open doors, independent of which one wins the class slot (MESITA-972).
 *  Standard is always open, so only the three earned/paid doors are carried.
 *  The class rail renders unlocked-vs-locked off this. */
type ClassDoors = {
  influencer: boolean;
  premium: boolean;
  aura: boolean;
};

type ConsumerClassState = {
  key: ClassKey;
  origin: "default" | "instagram" | "subscription" | "invitation";
  /** Subscription renewal date (ISO). Only meaningful when
   *  origin === "subscription"; null for every other origin. */
  renewsAt: string | null;
  followers: number;
  /** IG @handle for the connected account. Real handle is persisted on
   *  consumers.instagram_handle (read off the profile); this carries the
   *  demo handle for the Instagram preview state where no profile exists. */
  handle: string | null;
  doors: ClassDoors;
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
  doors: { influencer: false, premium: false, aura: false },
};

// Unknown/stale server keys (e.g. retired "magnetic") render as Standard
// instead of crashing a Record lookup.
function isClassKey(value: unknown): value is ClassKey {
  return (
    typeof value === "string" &&
    (CLASS_ORDER as readonly string[]).includes(value)
  );
}

function normalize(
  c: ConsumerClass | null | undefined,
  instagramHandle: string | null = null,
): ConsumerClassState {
  if (!c) {
    return {
      ...STANDARD_CLASS,
      handle: instagramHandle,
    };
  }
  const key = isClassKey(c.key) ? c.key : "standard";
  const followers = c.followers ?? 0;
  return {
    key,
    origin: c.origin ?? "default",
    renewsAt: c.subscription?.current_period_end ?? c.expires_at ?? null,
    followers,
    handle: instagramHandle,
    // Server-computed doors when the EF ships them; otherwise derive from
    // what the payload already proves (reach from followers, the paid door
    // from the live subscription, Aura only when it holds the slot).
    doors: c.doors ?? {
      influencer: followers >= INFLUENCER_FOLLOWER_THRESHOLD,
      premium: c.subscription != null,
      aura: key === "aura",
    },
  };
}

const ClassContext = createContext<ConsumerClassState>(STANDARD_CLASS);

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
  class: ClassKey | null;
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

// Parse + validate the stored blob. The snapshot is CACHED on the raw string:
// useSyncExternalStore compares snapshots by reference, so parsing fresh on
// every read would loop forever.
let mockAccountRaw: string | null = null;
let mockAccountCache: MockAccount | null = null;

function parseMockAccount(raw: string | null): MockAccount | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<MockAccount>;
    const cls = isClassKey(v.class) ? v.class : null;
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
    // Mock IG always surfaces the demo profile (@mock / 5k) so the Me card
    // preview is deterministic (MESITA-935).
    followers: mock.instagram ? mock.followers : base.followers,
    handle: mock.instagram ? DEMO_INSTAGRAM_HANDLE : base.handle,
    // Preview doors mirror ONLY the mocked axes so each demo state is
    // deterministic (a Standard preview shows every door locked, regardless
    // of the real account underneath).
    doors: {
      influencer: igInfluencer || mock.class === "influencer",
      premium: mock.class === "premium",
      aura: mock.class === "aura",
    },
  };
}

export function ClassProvider({
  consumerClass,
  instagramHandle = null,
  children,
}: {
  consumerClass: ConsumerClass | null;
  /** Real `consumers.instagram_handle` — Story Bonus gate (MESITA-909). */
  instagramHandle?: string | null;
  children: ReactNode;
}) {
  const base = useMemo(
    () => normalize(consumerClass, instagramHandle?.trim() || null),
    [consumerClass, instagramHandle],
  );

  const mockAccount = useMockAccount();

  const value = useMemo<ConsumerClassState>(() => {
    // Demo/design override (Me-page demo toggles) wins over everything so
    // every account state is previewable regardless of the real class.
    if (mockAccount) return mockAccountState(mockAccount, base);
    return base;
  }, [base, mockAccount]);

  return (
    <ClassContext.Provider value={value}>{children}</ClassContext.Provider>
  );
}

export function useConsumerClass(): ConsumerClassState {
  return useContext(ClassContext);
}
