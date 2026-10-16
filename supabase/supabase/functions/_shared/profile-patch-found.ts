// Peel google_found / instagram_found / facebook_found off a profiles patch
// before PostgREST updates the view; write them to place_profiles instead.

import {
  REVIEW_FOUND_FLAG_KEYS,
  type ReviewFoundFlagKey,
} from "./review-sources.ts";

type FoundPatch = Partial<Record<ReviewFoundFlagKey, boolean>>;

export function withoutFoundFlags<T extends object>(patch: T): {
  profile: Omit<T, ReviewFoundFlagKey>;
  found: FoundPatch;
} {
  const profile = { ...patch } as T & Record<ReviewFoundFlagKey, unknown>;
  const found: FoundPatch = {};
  for (const key of REVIEW_FOUND_FLAG_KEYS) {
    const value = profile[key];
    if (typeof value === "boolean") found[key] = value;
    delete profile[key];
  }
  return { profile, found };
}
