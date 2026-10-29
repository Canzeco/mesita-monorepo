"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { PROFILE_KEY, seedCached } from "@/lib/screen-cache";
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
// Identity is the one guest-facing fact: Instagram (`consumer-identity.ts`).
// The consumer app is Catalog · Discovery · Reservations (MESITA-2087), and
// nothing it shows is priced by who you are.

// The default for a tree rendered without a provider: a guest we know nothing
// about. Nothing is gated OPEN by it.
const NO_IDENTITY: ConsumerFacts = {
  igConnected: false,
  igHandle: null,
  igFollowers: 0,
  igReach: false,
  // The bare default is NOT a failed read — it is a tree that never asked.
  // Only the layout's catch sets `unknown`.
  unknown: false,
};

const IdentityContext = createContext<ConsumerFacts>(NO_IDENTITY);

// THE LAYOUT'S PROFILE ROW, FOR EVERY SCREEN (MESITA-3014). The shell layout
// already reads the whole row on the server; it used to pass on two fields and
// throw the rest away, so Me, Profile, Settings, Instagram, Plan and Class each
// read it again. The row rides this context (so a hard load renders real data
// in its HTML) and seeds lib/screen-cache.ts (so a client write wins after).
const ServerProfileContext = createContext<ConsumerProfile | null>(null);

/** The profile row the shell layout read on the server, or null. */
export function useServerProfile(): ConsumerProfile | null {
  return useContext(ServerProfileContext);
}

export function ConsumerIdentityProvider({
  instagramHandle = null,
  instagramFollowers = null,
  profileUnavailable = false,
  profile = null,
  children,
}: {
  /** The whole row the layout read; null when the read failed. */
  profile?: ConsumerProfile | null;
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
  const value = useMemo<ConsumerFacts>(() => {
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
      igConnected,
      igHandle,
      igFollowers,
      igReach: igConnected && igFollowers >= INSTAGRAM_REACH_FOLLOWERS,
      unknown: profileUnavailable,
    };
  }, [instagramHandle, instagramFollowers, profileUnavailable]);

  // Seeds the store during this render, before any reader below mounts. A
  // row already in the store (a write from this browser) is kept.
  useState(() => {
    if (profile) seedCached(PROFILE_KEY, profile);
    return null;
  });

  return (
    <ServerProfileContext.Provider value={profile}>
      <IdentityContext.Provider value={value}>
        {children}
      </IdentityContext.Provider>
    </ServerProfileContext.Provider>
  );
}

export function useConsumerIdentity(): ConsumerFacts {
  return useContext(IdentityContext);
}
