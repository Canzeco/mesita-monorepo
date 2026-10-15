// MESITA-2189 put these booleans on place_profiles and left them off the
// profiles view, so the view's INSTEAD OF trigger did not have to change.
// The enrichment patch still carries them. They have to be peeled off
// before that view is updated, then written to place_profiles.

export const FOUND_FLAG_KEYS = ["google_found", "instagram_found", "facebook_found"] as const;

export type FoundFlagKey = (typeof FOUND_FLAG_KEYS)[number];

type FoundPatch = Partial<Record<FoundFlagKey, boolean>>;

export function withoutFoundFlags<T extends object>(patch: T): {
  profile: Omit<T, FoundFlagKey>;
  found: FoundPatch;
} {
  const profile = { ...patch } as T & Record<FoundFlagKey, unknown>;
  const found: FoundPatch = {};
  for (const key of FOUND_FLAG_KEYS) {
    const value = profile[key];
    if (typeof value === "boolean") found[key] = value;
    delete profile[key];
  }
  return { profile, found };
}
