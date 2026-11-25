import { useQuery } from "@tanstack/react-query";

import { queryClient } from "@/lib/query";

import { getMyProfile } from "./api";
import type { Profile } from "./model";
import { useSession } from "./store";

export const profileKeys = {
  all: ["profile"] as const,
  mine: (guestId: string | null) => ["profile", "mine", guestId] as const,
};

const read = ({ signal }: { signal?: AbortSignal }) => getMyProfile(signal);

export function useMyProfile() {
  const { guestId } = useSession();
  return useQuery({
    queryKey: profileKeys.mine(guestId),
    queryFn: read,
    enabled: guestId !== null,
    meta: { persist: true },
  });
}

/** Read my profile again now, past any cached one. */
export function rereadMyProfile(guestId: string): Promise<Profile> {
  return queryClient.fetchQuery({
    queryKey: profileKeys.mine(guestId),
    queryFn: read,
    staleTime: 0,
    meta: { persist: true },
  });
}

export function setMyProfile(profile: Profile): void {
  queryClient.setQueryData(profileKeys.mine(profile.id), profile);
}
