"use client";

// Which Profile this place gets — read, never fetched (MESITA-1875).
//
// A held place renders admin's Single Place editor verbatim; a pool place
// renders identity and the claim door. That branch used to be
// `await getManagePlace(id)` at the top of the page — an Edge Function round
// trip, p50 472ms in production, whose entire result was `!== null`. The
// layout already made the same call and already branched on it (it renders
// `PlaceManageShell` only for a held place), so the answer travels down.

import { ProfileTab } from "./ProfileTab";
import { PoolProfile } from "./PoolProfile";
import { usePlaceScope } from "../PlaceScope";

export function PlaceProfileBody() {
  const { held } = usePlaceScope();
  return held ? <ProfileTab /> : <PoolProfile />;
}
