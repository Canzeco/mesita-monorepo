// The Story screen's one read (MESITA-4405), shared by consumer-web-get-story
// (read only) and consumer-web-check-story (bind first, then read): the
// Story, its purchase, the story it holds, the place's Instagram and time
// zone, and whether the test-mode buttons show.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { readStoryMentions, readStoryPurchases, type StoryRecord, storyView, type StoryView } from "./story.ts";
import { storyMode } from "./story-mention.ts";
import { readVoucherPlace } from "./wallet.ts";
import { instagramHandleOfUrl } from "./place-instagram.ts";
import { placeZone, PLACE_ZONE_COLUMNS } from "./local-time.ts";
import { paymentsLivemode } from "./stripe.ts";

export async function readStoryScreen(admin: SupabaseClient, s: StoryRecord, nowMs: number): Promise<StoryView & { place_name: string | null }> {
  const [purchases, mentions, placeRes, zone] = await Promise.all([
    readStoryPurchases(admin, [s.purchase_id]),
    readStoryMentions(admin, [s.mention_id]),
    readVoucherPlace(admin, s.place_id),
    admin.from("place_profiles").select(`id, ${PLACE_ZONE_COLUMNS}`).eq("id", s.place_id).maybeSingle(),
  ]);
  if (!placeRes.ok) throw new Error(placeRes.error);
  const place = placeRes.place;
  const view = storyView(s, {
    purchase: purchases.get(s.purchase_id) ?? null,
    mention: s.mention_id ? mentions.get(s.mention_id) ?? null : null,
    placeHandle: instagramHandleOfUrl(place?.instagram_url ?? null),
    timeZone: placeZone((zone.error ? null : zone.data) as { timezone?: unknown; lng?: unknown } | null),
    emulator: !paymentsLivemode() && storyMode() === "emulated",
    nowMs,
  });
  return { ...view, place_name: place?.name ?? null };
}
