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
  identityForClassKey,
  type ClassKey,
  type PlanKey,
} from "@/lib/consumer-data";
import {
  INSTAGRAM_REACH_FOLLOWERS,
  type ConsumerFacts,
} from "@/lib/consumer-identity";

// Real, server-sourced class for the signed-in consumer, shared with
// every client surface under the (shell) layout: the Profile Class tab, the
// place promo chips, and the place-detail reward box.
//
// Seeded once per request by the layout's consumer-web-get-profile read. This
// replaces the old hardcoded CURRENT_USER mock that pinned everyone to
// Premium — key now reflects the real consumers.class_key from the profile EF.

/** THE DOORS ARE GONE WITH THE LADDER THEY CLIMBED (MESITA-2040). `ClassDoors`
 *  carried `{ reach, invitation }` — the two ways UP one axis. There is no
 *  axis now: Instagram and Diamond are two independent facts, each true or
 *  false on its own, and they live on `ConsumerFacts` in consumer-identity.ts.
 *
 *  What was `doors.reach` is `igReach`; what was `doors.invitation` is
 *  `diamond`. They are not renames of each other — the old pair described HOW
 *  a rung was granted, this pair describes WHAT the guest holds. */

type ConsumerClassState = {
  /** STORAGE, NOT VOCABULARY (MESITA-2040). `consumers.class_key` still
   *  prices Rewards — place detail's matrix, the ticket screen and Help all
   *  read a rung because the engine really applies one. NOTHING ON THE
   *  IDENTITY SURFACE may name it: Me and the two doors read
   *  `facts` instead. */
  key: ClassKey;
  /** Plan axis — what you pay. Private; never shown to a place. */
  plan: PlanKey;
  /** How the CLASS was granted. "subscription" is deliberately absent: under
   *  v2 paying grants a PLAN, never a rung. */
  origin: "default" | "instagram" | "invitation";
  /** Premium renewal date (ISO). Null on the Free plan. */
  renewsAt: string | null;
  followers: number;
  /** IG @handle for the connected account. Real handle is persisted on
   *  consumers.instagram_handle (read off the profile); this carries the
   *  demo handle for the Instagram preview state where no profile exists. */
  handle: string | null;
  /** The two guest-facing facts (MESITA-2040). Everything a surface should
   *  SAY about an account is here; `key`/`origin` below are storage. */
  facts: ConsumerFacts;
  /** TRUE when the profile read FAILED and this state is the floor fallback
   *  rather than the guest's real class (MESITA design review 2026-08-22).
   *
   *  The shell layout catches a consumer-get-profile throw and renders
   *  degraded on purpose — its comment says "let each page surface its own
   *  error". Nothing did, so `normalize(null)` returning FLOOR_CLASS made
   *  "we don't know your class" and "your class is Bronze" the same state.
   *  Harmless on surfaces that only read this for STYLING; on the Class sheet
   *  it is the entire content, and it was asserted to screen readers via
   *  aria-current. Fails closed on permissions, wrong on information.
   *
   *  Any surface that STATES the class (rather than colouring with it) must
   *  branch on this before treating the floor as fact. */
  unknown: boolean;
};

// Safe default for any tree rendered without a provider: the floor on both
// axes. Nothing is ever gated *open* by this default — the worst case is a
// real elevated member momentarily shown as Bronze/Free, which the
// server-seeded value corrects on first paint.
const FLOOR_CLASS: ConsumerClassState = {
  key: "bronze",
  plan: "free",
  origin: "default",
  renewsAt: null,
  followers: 0,
  handle: null,
  facts: {
    diamond: false,
    igConnected: false,
    igHandle: null,
    igFollowers: 0,
    igReach: false,
    unknown: false,
  },
  // The bare default (no provider) is NOT a failed read — it is a tree that
  // never asked. Only the layout's catch sets `unknown`.
  unknown: false,
};

// `isClassKey` LIVED HERE AND IS GONE (MESITA-2040). It guarded the demo
// blob's `class` field — a four-value enum — so a stale localStorage write
// naming a retired key degraded to "no override" instead of crashing a Record
// lookup. The demo blob carries booleans now; there is no key to validate, and
// `identityForClassKey` below already falls back to the floor for any string
// the server sends.

function normalize(
  c: ConsumerClass | null | undefined,
  instagramHandle: string | null = null,
  unknown = false,
): ConsumerClassState {
  if (!c) {
    return {
      ...FLOOR_CLASS,
      handle: instagramHandle,
      facts: {
        ...FLOOR_CLASS.facts,
        igConnected: Boolean(instagramHandle),
        igHandle: instagramHandle,
        unknown,
      },
      unknown,
    };
  }
  // THE BRIDGE, applied at the one boundary where server truth enters the
  // client: `consumers.class_key` still stores a legacy key, so it is split
  // onto the two axes here and nowhere downstream (MESITA-1079).
  const { cls, plan: bridgedPlan } = identityForClassKey(c.key, c.plan);
  const followers = c.followers ?? 0;
  const plan: PlanKey =
    bridgedPlan === "premium" || c.subscription != null ? "premium" : "free";
  return {
    // THE FAILURE SIGNAL WINS. Today this is belt-and-braces — the layout only
    // assigns `consumerClass` inside its try, so a throw always pairs with a
    // null row and this branch never sees `unknown`. It is written this way
    // so the prop means one thing: a caller that says the read failed is
    // believed, even if class data is also present. A future refactor that
    // keeps a stale cached class while marking the read failed gets the safe
    // behaviour for free instead of silently restating the stale rung.
    unknown,
    key: cls,
    plan,
    // The server's "subscription" origin describes the PLAN, so it can't be a
    // class origin — such an account is Bronze by class, however it pays.
    origin:
      c.origin === "instagram" || c.origin === "invitation"
        ? c.origin
        : "default",
    renewsAt:
      plan === "premium"
        ? (c.subscription?.current_period_end ?? c.expires_at ?? null)
        : null,
    followers,
    handle: instagramHandle,
    // THE TWO FACTS, READ OFF THE STORAGE THAT ALREADY EXISTS (MESITA-2040).
    //
    // DIAMOND IS THE BRIDGED CLASS KEY, not the origin. It was tempting to
    // ask `origin === "invitation"` — an invitation is the only door — but
    // the two answer different questions. Origin says HOW the row was last
    // written, and the admin console's grant writes Diamond with no origin
    // at all; the class key says WHAT the guest holds. A hand-granted Diamond
    // whose origin never got stamped is still a Diamond, and reading origin
    // would have quietly told them they are not. (The granting function is
    // named in Docs › Passport §C — NOT here: `ef-caller-acl.test.ts`
    // string-scans this package and an admin-actor EF named in consumer
    // source is a caller violation, comment or not.)
    //
    // INSTAGRAM IS THE HANDLE PLUS THE BAR, and the two are separate on
    // purpose. Story Bonus rides a connected handle and always has
    // (MESITA-909); the 1,000 bar is what makes a guest VERIFIED. Folding
    // them into one boolean would either promise the bonus to nobody under
    // the bar or call everyone with a handle verified.
    facts: {
      diamond: cls === "diamond",
      igConnected: Boolean(instagramHandle) || c.origin === "instagram",
      igHandle: instagramHandle,
      igFollowers: followers,
      igReach:
        (Boolean(instagramHandle) || c.origin === "instagram") &&
        followers >= INSTAGRAM_REACH_FOLLOWERS,
      unknown,
    },
  };
}

const ClassContext = createContext<ConsumerClassState>(FLOOR_CLASS);

// ── Server-seeded identity (MESITA-1029 S1) ────────────────────────────────
// The shell layout fetches the profile ONCE per request and does NOT re-run on
// soft navigation — so pages must never re-fetch what this context already
// carries. THE TICKET's server page used to duplicate auth.getUser() + the
// profile EF on every open; that duplication was the single biggest chunk of
// the "tap feels frozen" delay. Identity rides here instead.

export type ConsumerIdentity = {
  /** auth.users id — always present under /(shell) (the layout gates). */
  userId: string;
  /** "First Last" > full_name > null (renders as "Mesita guest"). */
  displayName: string | null;
  avatarUrl: string | null;
};

const IdentityContext = createContext<ConsumerIdentity>({
  userId: "",
  displayName: null,
  avatarUrl: null,
});

// (The old MOCK_INSTAGRAM_KEY path is gone — the Verify Instagram sheet now
// calls consumer-web-claim-instagram for a real server-side grant, MESITA-74.)

// Demo/design override. The Me-page demo toggles write this JSON blob so
// every account state is previewable regardless of the real server-seeded
// account. THREE independent booleans now, mirroring the real model
// (MESITA-2040):
//   • diamond   — invited, by hand. The only door there is.
//   • instagram — a connected Instagram (handle + follower count).
//   • premium   — the PLAN axis, independent of both. A guest who is neither
//                 Diamond nor on Instagram can still be Premium.
//
// THE CLASS AXIS IS GONE FROM HERE, and that is the point: `class` was a
// four-value enum, so the demo could express "Silver" — a state the product
// no longer has. Three booleans give eight states and every one of them is
// real.
//
// Purely a client-side dev affordance; absent = the real account. Remove the
// toggles + this key once the states can be produced with real data.
//
// Blobs written by the older toggles carry a `class` field instead. It is
// ignored, EXCEPT that a stored `"diamond"` is honoured — that is the one
// value of the old enum which still names something true, so a design session
// parked on Diamond does not silently drop to nothing on reload.
const MOCK_ACCOUNT_KEY = "mesita:mock-account";
export type MockAccount = {
  diamond: boolean;
  premium: boolean;
  instagram: boolean;
  followers: number;
};

const MOCK_ACCOUNT_OFF: MockAccount = {
  diamond: false,
  premium: false,
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
  for (const l of storeListeners) l();
}

// Parse + validate the stored blob. The snapshot is CACHED on the raw string:
// useSyncExternalStore compares snapshots by reference, so parsing fresh on
// every read would loop forever.
let mockAccountRaw: string | null = null;
let mockAccountCache: MockAccount | null = null;

function parseMockAccount(raw: string | null): MockAccount | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<MockAccount> & { class?: unknown };
    // A legacy blob's `class` survives only where it still names a fact.
    const diamond = v.diamond === true || v.class === "diamond";
    const premium = v.premium === true;
    const instagram = v.instagram === true;
    if (!diamond && !premium && !instagram) return null; // nothing overridden
    const followers =
      typeof v.followers === "number" &&
      Number.isFinite(v.followers) &&
      v.followers >= 0
        ? Math.trunc(v.followers)
        : DEMO_INSTAGRAM_FOLLOWERS;
    return { diamond, premium, instagram, followers };
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
      if (!next.diamond && !next.premium && !next.instagram) {
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
  // THREE BOOLEANS, NO PRECEDENCE (MESITA-2040). The old function had a
  // ladder to resolve — IG reach granted the entry rung, an explicit Diamond
  // preview outranked it, a bare `class` override sat underneath — because
  // both doors wrote the SAME field and one of them had to win. Nothing
  // competes now: Diamond and Instagram land in different fields, so the
  // preview is the toggles, verbatim.
  const igFollowers = mock.instagram ? mock.followers : 0;
  const igReach = mock.instagram && igFollowers >= INSTAGRAM_REACH_FOLLOWERS;

  // `key` and `origin` are STORAGE, and the demo still has to seed them:
  // place detail, the ticket screen and Help read a rung off them because the
  // rewards engine really applies one. Diamond maps to the diamond row; every
  // other previewed account sits on the floor, which is what an account with
  // no invitation actually holds. An Instagram preview does NOT lift the rung
  // any more — that was the ladder's doing, and the ladder is gone.
  const key: ConsumerClassState["key"] = mock.diamond ? "diamond" : "bronze";
  const origin: ConsumerClassState["origin"] = mock.diamond
    ? "invitation"
    : mock.instagram
      ? "instagram"
      : "default";

  // The plan axis is mocked INDEPENDENTLY of both facts. A guest who is
  // neither Diamond nor on Instagram can still be Premium, and that state has
  // to be previewable or the Plan surfaces cannot be designed.
  const renews = new Date();
  renews.setMonth(renews.getMonth() + 1);

  return {
    // A previewed account is a KNOWN account — the toggles state it outright.
    // Without this a degraded read would leak into every preview and the Demo
    // box would be unable to demonstrate the very states it exists for.
    unknown: false,
    key,
    plan: mock.premium ? "premium" : "free",
    origin,
    renewsAt: mock.premium ? renews.toISOString() : null,
    // Mock IG always surfaces the demo profile (@mock / 5k) so the preview is
    // deterministic (MESITA-935).
    followers: mock.instagram ? mock.followers : base.followers,
    handle: mock.instagram ? DEMO_INSTAGRAM_HANDLE : base.handle,
    // The facts mirror ONLY the toggles, so each demo state is deterministic
    // regardless of the real account underneath.
    facts: {
      diamond: mock.diamond,
      igConnected: mock.instagram,
      igHandle: mock.instagram ? DEMO_INSTAGRAM_HANDLE : null,
      igFollowers,
      igReach,
      unknown: false,
    },
  };
}

export function ClassProvider({
  consumerClass,
  instagramHandle = null,
  userId = "",
  displayName = null,
  avatarUrl = null,
  classUnavailable = false,
  children,
}: {
  consumerClass: ConsumerClass | null;
  /** The profile read THREW (not "returned nothing"). The two are different
   *  and only the layout can tell them apart, so it says which. */
  classUnavailable?: boolean;
  /** Real `consumers.instagram_handle` — Story Bonus gate (MESITA-909). */
  instagramHandle?: string | null;
  /** Seeded by the shell layout; identity for every client surface below. */
  userId?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  children: ReactNode;
}) {
  const base = useMemo(
    () =>
      normalize(
        consumerClass,
        instagramHandle?.trim() || null,
        classUnavailable,
      ),
    [consumerClass, instagramHandle, classUnavailable],
  );

  const mockAccount = useMockAccount();

  const value = useMemo<ConsumerClassState>(() => {
    // Demo/design override (Me-page demo toggles) wins over everything so
    // every account state is previewable regardless of the real class.
    if (mockAccount) return mockAccountState(mockAccount, base);
    return base;
  }, [base, mockAccount]);

  const identity = useMemo<ConsumerIdentity>(
    () => ({ userId, displayName, avatarUrl }),
    [userId, displayName, avatarUrl],
  );

  return (
    <IdentityContext.Provider value={identity}>
      <ClassContext.Provider value={value}>{children}</ClassContext.Provider>
    </IdentityContext.Provider>
  );
}

export function useConsumerClass(): ConsumerClassState {
  return useContext(ClassContext);
}

export function useConsumerIdentity(): ConsumerIdentity {
  return useContext(IdentityContext);
}
