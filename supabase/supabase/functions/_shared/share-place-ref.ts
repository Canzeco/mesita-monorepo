// MESITA-5060: the place a share link names, by its id or its slug. Read-only,
// `id` alone: share counts only need to know which place, never its fields.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isUuid } from "./place-id.ts";

/** A place id from a link's id or slug; null for no place, an unknown one or a failed read. */
export async function resolvePlaceRef(admin: SupabaseClient, ref: string | null): Promise<string | null> {
  if (!ref) return null;
  const q = admin.from("places").select("id");
  const { data, error } = await (isUuid(ref) ? q.eq("id", ref) : q.eq("slug", ref)).maybeSingle();
  if (error) {
    console.error(`[share-place-ref] places read: ${error.message}`);
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}
