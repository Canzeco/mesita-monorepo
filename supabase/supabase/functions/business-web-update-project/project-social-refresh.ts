import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import {
  refreshSocialFollowers,
  runFollowersRefreshInBackground,
} from "../_shared/social-followers.ts";

export type PreviousSocialUrls = {
  instagram_url: string | null;
  facebook_url: string | null;
};

function updatesSocialUrl(update: Record<string, unknown>): boolean {
  return "instagram_url" in update || "facebook_url" in update;
}

export async function loadPreviousSocialUrlsForRefresh(
  admin: SupabaseClient,
  projectId: string,
  update: Record<string, unknown>,
  apifyKey: string | undefined,
): Promise<PreviousSocialUrls | null> {
  if (!apifyKey || !updatesSocialUrl(update)) return null;

  const { data: prev } = await admin
    .from("places")
    .select("instagram_url, facebook_url")
    .eq("id", projectId)
    .maybeSingle();

  return (prev as PreviousSocialUrls | null) ?? null;
}

export function queueSocialFollowersRefresh(opts: {
  admin: SupabaseClient;
  apifyKey: string | undefined;
  projectId: string;
  update: Record<string, unknown>;
  prevSocial: PreviousSocialUrls | null;
}): void {
  const { admin, apifyKey, projectId, update, prevSocial } = opts;
  if (!apifyKey) return;

  const igNext = "instagram_url" in update
    ? (update.instagram_url as string | null)
    : undefined;
  const fbNext = "facebook_url" in update
    ? (update.facebook_url as string | null)
    : undefined;
  const igChanged = igNext !== undefined &&
    igNext !== (prevSocial?.instagram_url ?? null);
  const fbChanged = fbNext !== undefined &&
    fbNext !== (prevSocial?.facebook_url ?? null);

  if (!igChanged && !fbChanged) return;

  runFollowersRefreshInBackground(
    refreshSocialFollowers({
      admin,
      apifyKey,
      placeId: projectId,
      ...(igChanged ? { instagramUrl: igNext } : {}),
      ...(fbChanged ? { facebookUrl: fbNext } : {}),
    }).catch(() => {}),
  );
}
