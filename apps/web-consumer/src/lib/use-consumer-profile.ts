"use client";

// The signed-in guest's profile row, for any screen (MESITA-3014): the row the
// shell layout already read, kept in lib/screen-cache.ts and revalidated after
// five minutes. Writes through apiUpdateConsumerProfile land here at once.

import {
  apiFetchConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";
import { useServerProfile } from "@/lib/identity-context";
import { PROFILE_KEY } from "@/lib/screen-cache";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { useCachedQuery, type CachedQuery } from "@/lib/use-cached-query";

const PROFILE_TTL_MS = 5 * 60 * 1000;

export function useConsumerProfile(): CachedQuery<ConsumerProfile> {
  const getSupabase = useLazyBrowserSupabase();
  const seed = useServerProfile();
  return useCachedQuery(
    PROFILE_KEY,
    () => apiFetchConsumerProfile(getSupabase()).then((r) => r.consumer),
    { ttl: PROFILE_TTL_MS, seed },
  );
}
