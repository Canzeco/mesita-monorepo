// POST (MESITA-4714): what an Instagram story pays at one place, and the
// test-mode story emulator. The server decides every number
// (consumer-web-get-story-reward, consumer-web-simulate-story); the Post tab
// (place-profile's PostSection) only formats them.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostTabRead } from "@mesita/place-profile";
import { invokeEF } from "./_invoke";

export async function apiGetStoryReward(client: SupabaseClient, placeId: string): Promise<PostTabRead> {
  const r = await invokeEF<{ post: PostTabRead }>(client, "consumer-web-get-story-reward", { place_id: placeId });
  return r.post;
}

export async function apiSimulateStory(
  client: SupabaseClient,
  placeId: string,
): Promise<{ outcome: "verified" | "rejected"; story: NonNullable<PostTabRead["latest"]> }> {
  // MESITA-4717: the simulator runs the first check only; the cron rechecks
  // and pays a couple of minutes later.
  return await invokeEF<{ outcome: "verified" | "rejected"; story: NonNullable<PostTabRead["latest"]> }>(
    client,
    "consumer-web-simulate-story",
    { place_id: placeId },
  );
}

/** One of the guest's own Instagram stories, as consumer-web-list-stories
 *  answers it (MESITA-4738, Me › Tickets › Stories). `place` is null while
 *  the check has not tied the story to a place. `credit_cents` only when
 *  rewarded. */
export type GuestStory = {
  id: string;
  place: { id: string; name: string | null; slug: string | null; photo_url: string | null } | null;
  state: "checking" | "verified" | "rewarded" | "rejected";
  credit_cents: number | null;
  currency: string | null;
  posted_at: string;
  decided_at: string | null;
  simulated: boolean;
};

export async function apiListStories(
  client: SupabaseClient,
): Promise<{ stories: GuestStory[]; truncated: boolean }> {
  return await invokeEF<{ stories: GuestStory[]; truncated: boolean }>(
    client,
    "consumer-web-list-stories",
    {},
    "Couldn't load your stories",
  );
}
