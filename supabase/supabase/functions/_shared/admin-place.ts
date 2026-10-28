// The AdminPlace read-back the admin place-state doors (set-place-active,
// set-place-listed, delete-place) end on, so the console reconciles from one
// call. One `profiles` row in PLACE_PROFILE_COLUMNS; a read error is the 500
// `place_read: …` every one of those doors answered inline before
// MESITA-2982.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "./http.ts";
import { PLACE_PROFILE_COLUMNS } from "./place-columns.ts";

export async function readAdminPlace(
  admin: SupabaseClient,
  placeId: string,
): Promise<{ ok: true; place: unknown } | { ok: false; response: Response }> {
  const { data: place, error } = await admin
    .from("profiles")
    .select(PLACE_PROFILE_COLUMNS)
    .eq("id", placeId)
    .single();
  if (error) {
    return {
      ok: false,
      response: json({ ok: false, error: `place_read: ${error.message}` }, 500),
    };
  }
  return { ok: true, place };
}
