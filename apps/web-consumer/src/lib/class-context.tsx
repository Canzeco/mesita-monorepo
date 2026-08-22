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
  REACH_ENTRY_CLASS,
  REACH_ENTRY_FOLLOWERS,
  identityForClassKey,
  type ClassKey,
  type PlanKey,
} from "@/lib/consumer-data";

// Real, server-sourced class for the signed-in consumer, shared with
// every client surface under the (shell) layout: the Profile Class tab, the
// place promo chips, and the place-detail reward box.
//
// Seeded once per request by the layout's consumer-web-get-profile read. This
// replaces the old hardcoded CURRENT_USER mock that pinned everyone to
// Premium — key now reflects the real consumers.class_key from the profile EF.

/** The two doors UP THE CLASS LADDER (MESITA-972, re-cut for v2). Bronze is
 *  always open, so only the earned doors are carried — and paying is no longer
 *  one of them: Premium moved to the plan axis, where money belongs. */
type ClassDoors = {
  /** Instagram reach at or above the entry bar — the Silver door. */
  reach: boolean;
  /** Your class was handed to you directly by Mesita. Not tied to any rung:
   *  an invitation NAMES a class (the EF's `invitationClassKey`), so it can
   *  grant Bronze or Diamond alike. */
  invitation: boolean;
};

type ConsumerClassState = {
  /** Class axis — who you are. Public; shows on the Passport. */
  key: ClassKey;
  /** Plan axis — what you pay. Private; never shown to a venue. */
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
  doors: ClassDoors;
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
  doors: { reach: false, invitation: false },
  // The bare default (no provider) is NOT a failed read — it is a tree that
  // never asked. Only the layout's catch sets `unknown`.
  unknown: false,
};

// Unknown/stale keys render as the floor instead of crashing a Record lookup.
function isClassKey(value: unknown): value is ClassKey {
  return (
    typeof value === "string" &&
    (CLASS_ORDER as readonly string[]).includes(value)
  );
}

function normalize(
  c: ConsumerClass | null | undefined,
  instagramHandle: string | null = null,
  unknown = false,
): ConsumerClassState {
  if (!c) {
    return {
      ...FLOOR_CLASS,
      handle: instagramHandle,
      unknown,
    };
  }
  // THE BRIDGE, applied at the one boundary where server truth enters the
  // client: `consumers.class_key` still stores a legacy key, so it is split
  // onto the two axes here and nowhere downstream (MESITA-1079).
  const { cls, plan: bridgedPlan } = identityForClassKey(c.key);
  const followers = c.followers ?? 0;
  // A live subscription proves Premium independently of the key. Today the two
  // always agree (a payer's class_key IS "premium"), but trusting either alone
  // would break the moment consumers.plan lands and the key stops carrying it.
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
    // TWO WAYS IN, and only two (decision: Pato, MESITA-1126): follower count,
    // automatic; or an invitation, manual.
    //
    // `reach` still reads the server's legacy `influencer` door — that key is
    // storage, not vocabulary. `invitation` no longer asks "are you Diamond?":
    // an invitation names ANY class, so the honest question is whether an
    // invitation is what granted the class you hold. The old `aura` door and
    // the `cls === "diamond"` fallback both encoded the retired idea that
    // invitations only ever led to the top rung.
    doors: {
      reach: c.doors?.influencer ?? followers >= REACH_ENTRY_FOLLOWERS,
      invitation: c.origin === "invitation",
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
// class. THREE independent axes now, mirroring the real v2 model:
//   • class     — forced class ("bronze" down-previews a real elevated
//                 account; diamond = via invitation, silver/gold = via reach).
//                 null = real class.
//   • premium   — the PLAN axis, independent of class. A Bronze guest on
//                 Premium is a normal, previewable state; under v1 it was
//                 unrepresentable because paying WAS the class.
//   • instagram — a connected Instagram (handle + follower reach). Crossing
//                 REACH_ENTRY_FOLLOWERS grants Silver — exactly like a
//                 qualifying consumer-web-claim-instagram claim writes it.
// Purely a client-side dev affordance; absent = the real account. Remove the
// toggles + this key once the states can be produced with real data.
//
// Blobs written by the v1 toggles carry retired keys ("standard", "aura", …);
// isClassKey rejects them, so a stale blob degrades to "no class override"
// rather than pinning a preview to a class that no longer exists.
const MOCK_ACCOUNT_KEY = "mesita:mock-account";
export type MockAccount = {
  class: ClassKey | null;
  premium: boolean;
  instagram: boolean;
  followers: number;
};

const MOCK_ACCOUNT_OFF: MockAccount = {
  class: null,
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
    const premium = v.premium === true;
    const instagram = v.instagram === true;
    if (cls == null && !premium && !instagram) return null; // nothing overridden
    const followers =
      typeof v.followers === "number" &&
      Number.isFinite(v.followers) &&
      v.followers >= 0
        ? Math.trunc(v.followers)
        : DEMO_INSTAGRAM_FOLLOWERS;
    return { class: cls, premium, instagram, followers };
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
      if (next.class == null && !next.premium && !next.instagram) {
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
  // Instagram reach wins over the class axis (except an explicit Diamond
  // preview — an invitation outranks the reach door), exactly like a
  // qualifying consumer-web-claim-instagram claim writes class_key
  // server-side but never clobbers a higher-ranked invitation class.
  const igReach =
    mock.instagram &&
    mock.followers >= REACH_ENTRY_FOLLOWERS &&
    mock.class !== "diamond";

  let key: ConsumerClassState["key"];
  let origin: ConsumerClassState["origin"];
  if (igReach) {
    // The ENTRY rung, named by the ladder rather than by hand. Deliberately
    // not "the highest bar this count clears": the EF grants off `classes`,
    // which has no gold row, so a 5,000-follower claim really does land on
    // the entry rung server-side. Promoting the preview past it would make
    // the demo promise a class production cannot grant.
    key = REACH_ENTRY_CLASS.id;
    origin = "instagram";
  } else if (mock.class === "diamond") {
    // Diamond is previewed through the manual door. Not because Diamond is
    // special — an invitation can name any class — but because the reach
    // branch above already covers the automatic route.
    key = "diamond";
    origin = "invitation";
  } else if (mock.class === "silver" || mock.class === "gold") {
    // A reach preview without the IG axis on — still the reach door.
    key = mock.class;
    origin = "instagram";
  } else if (mock.class === "bronze") {
    key = "bronze";
    origin = "default";
  } else {
    // No class override — the real class shows through the IG emulation.
    ({ key, origin } = base);
  }

  // The plan axis is mocked INDEPENDENTLY of the class, which is the whole
  // point of v2: Bronze-on-Premium is a real state, and under v1 it could not
  // even be expressed because paying was itself the class.
  const renews = new Date();
  renews.setMonth(renews.getMonth() + 1);

  return {
    // A previewed class is a KNOWN class — the demo toggle states it outright.
    // Without this a degraded read would leak into every preview and the
    // Demo box would be unable to demonstrate the very states it exists for.
    unknown: false,
    key,
    plan: mock.premium ? "premium" : "free",
    origin,
    renewsAt: mock.premium ? renews.toISOString() : null,
    // Mock IG always surfaces the demo profile (@mock / 5k) so the Me card
    // preview is deterministic (MESITA-935).
    followers: mock.instagram ? mock.followers : base.followers,
    handle: mock.instagram ? DEMO_INSTAGRAM_HANDLE : base.handle,
    // Preview doors mirror ONLY the mocked axes so each demo state is
    // deterministic (a Bronze preview shows every door locked, regardless of
    // the real account underneath).
    doors: {
      reach: igReach || mock.class === "silver" || mock.class === "gold",
      invitation: origin === "invitation",
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
