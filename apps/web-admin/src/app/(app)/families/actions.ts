"use server";

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";
import type { FamiliesMap } from "./highlight";

export async function getFamiliesMap(): Promise<ActionResult<FamiliesMap>> {
  const r = await efInvoke<FamiliesMap & { ok: boolean }>("admin-web-get-families", {});
  if (!r.ok) return { ok: false, error: r.error };
  if (!r.data.families?.length) {
    return { ok: false, error: "Families did not load." };
  }
  return {
    ok: true,
    families: r.data.families,
    categories: r.data.categories ?? [],
    googleTypes: r.data.googleTypes ?? [],
    tags: r.data.tags ?? [],
  };
}
