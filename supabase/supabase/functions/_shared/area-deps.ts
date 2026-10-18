// The two side effects the Area pool needs from an Edge Function, written
// once so the Feed and the Map cannot drift (MESITA-2379): the per-IP Nearby
// ledger, and the lookup of the ready Mesita rows that own a set of Google
// Place IDs. Each EF passes its own client — the Map reads with the ANON
// key (RLS decides what a consumer may see), the Feed with service role.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { hashConnectingIp } from "./connecting-ip.ts";
import { consumeNearbyGoogleQuota } from "./nearby-google-quota.ts";
import type { OwnedRow } from "./area-pipeline.ts";

/** One ledger row per billed Nearby call. Identity is CF-Connecting-IP /
 *  rightmost XFF, never the spoofable leftmost hop. */
export function areaQuota(
  req: Request,
  admin: SupabaseClient,
  serviceKey: string,
): () => Promise<boolean> {
  return async () => {
    const ipHash = await hashConnectingIp(req, serviceKey);
    return (await consumeNearbyGoogleQuota(admin, ipHash)).allow;
  };
}

/** Ready Mesita rows holding these google ids, in card columns; null on
 *  error (the pool then fails closed on its Google side). `shape` maps a raw
 *  row to the wire (the Feed strips internals; the Map keeps rows as is). */
export function ownedLookup(
  client: SupabaseClient,
  columns: string,
  label: string,
  shape: (rows: unknown[]) => OwnedRow[] = (rows) => rows as OwnedRow[],
): (gids: string[]) => Promise<OwnedRow[] | null> {
  return async (gids) => {
    const owned = await client
      .from("profiles")
      .select(`${columns}, google_place_id`)
      .eq("state", "active")
      .eq("content_state", "ready")
      .in("google_place_id", gids);
    if (owned.error) {
      console.error(`[${label}] owned gid lookup:`, owned.error.message);
      return null;
    }
    return shape(owned.data ?? []);
  };
}
