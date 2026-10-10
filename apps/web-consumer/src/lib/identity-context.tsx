"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  INSTAGRAM_REACH_FOLLOWERS,
  type ConsumerFacts,
} from "@/lib/consumer-identity";

// Who the signed-in guest is, for every client surface under the (shell)
// layout.
//
// Seeded ONCE per request by the layout's consumer-web-get-profile read. The
// layout does not re-run on soft navigation, so pages read identity from here
// instead of calling the profile EF per open — that duplicated fetch was the
// single biggest chunk of a "tap feels frozen" delay (MESITA-1029 S1).
//
// Identity is the name, the photo and the one guest-facing fact: Instagram
// (`consumer-identity.ts`). The consumer app is Catalog · Discovery ·
// Reservations (MESITA-2087), and nothing it shows is priced by who you are.

export type ConsumerIdentity = ConsumerFacts & {
  /** auth.users id — always present under /(shell) (the layout gates). */
  userId: string;
  /** "First Last" > full_name > null (renders as "Mesita guest"). */
  displayName: string | null;
  avatarUrl: string | null;
};

// The default for a tree rendered without a provider: a guest we know nothing
// about. Nothing is gated OPEN by it.
const NO_IDENTITY: ConsumerIdentity = {
  userId: "",
  displayName: null,
  avatarUrl: null,
  igConnected: false,
  igHandle: null,
  igFollowers: 0,
  igReach: false,
  // The bare default is NOT a failed read — it is a tree that never asked.
  // Only the layout's catch sets `unknown`.
  unknown: false,
};

const IdentityContext = createContext<ConsumerIdentity>(NO_IDENTITY);

export function ConsumerIdentityProvider({
  userId,
  displayName = null,
  avatarUrl = null,
  instagramHandle = null,
  instagramFollowers = null,
  profileUnavailable = false,
  children,
}: {
  userId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  /** Real `consumers.instagram_handle`, normalized (no leading @). */
  instagramHandle?: string | null;
  /** Real `consumers.instagram_followers_count`. */
  instagramFollowers?: number | null;
  /** The profile read THREW (not "returned nothing"). The two are different
   *  and only the layout can tell them apart, so it says which. A surface
   *  that STATES the Instagram fact must branch on `unknown` before treating
   *  "not connected" as true (design review 2026-08-22). */
  profileUnavailable?: boolean;
  children: ReactNode;
}) {
  const value = useMemo<ConsumerIdentity>(() => {
    // INSTAGRAM IS THE HANDLE PLUS THE BAR, and the two stay separate on
    // purpose: a handle on the account is "connected"; connected AND at or
    // over `INSTAGRAM_REACH_FOLLOWERS` is "verified". A follower count with
    // no handle is a stale column on a disconnected account, not a
    // connection — so the count only counts once there is a handle.
    const igHandle = instagramHandle?.trim() || null;
    const igConnected = Boolean(igHandle);
    const igFollowers =
      igConnected && instagramFollowers != null && instagramFollowers > 0
        ? Math.trunc(instagramFollowers)
        : 0;
    return {
      userId,
      displayName,
      avatarUrl,
      igConnected,
      igHandle,
      igFollowers,
      igReach: igConnected && igFollowers >= INSTAGRAM_REACH_FOLLOWERS,
      unknown: profileUnavailable,
    };
  }, [
    userId,
    displayName,
    avatarUrl,
    instagramHandle,
    instagramFollowers,
    profileUnavailable,
  ]);

  return (
    <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
  );
}

export function useConsumerIdentity(): ConsumerIdentity {
  return useContext(IdentityContext);
}
