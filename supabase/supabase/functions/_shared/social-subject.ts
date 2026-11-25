// MESITA-4942: Social names a person by the event the guest tapped
// (place, kind, time). The client never sends another member's id.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isMesitaPlaceId } from "./place-activity.ts";

const KINDS = ["saved", "viewed"] as const;

export async function subjectOf(
  admin: SupabaseClient,
  placeId: unknown,
  kind: unknown,
  at: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!isMesitaPlaceId(typeof placeId === "string" ? placeId : "")) {
    return { ok: false, error: "place_id must be a Mesita place id" };
  }
  if (typeof kind !== "string" || !KINDS.includes(kind as (typeof KINDS)[number])) {
    return { ok: false, error: "kind must be saved or viewed" };
  }
  if (typeof at !== "string" || !Number.isFinite(Date.parse(at))) {
    return { ok: false, error: "at must be the event's time" };
  }
  const { data, error } = await admin
    .from("place_activity")
    .select("consumer_id")
    .eq("place_id", placeId)
    .eq("kind", kind)
    .eq("created_at", at)
    .limit(1);
  if (error) return { ok: false, error: error.message };
  const id = (data?.[0] as { consumer_id?: string } | undefined)?.consumer_id;
  if (!id) return { ok: false, error: "That person is gone" };
  return { ok: true, id };
}
