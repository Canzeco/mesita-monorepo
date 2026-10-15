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

export async function setCategoryFamilies(
  slug: string,
  familyKeys: string[],
): Promise<ActionResult<{ slug: string; familyKeys: string[] }>> {
  const r = await efInvoke<{ slug: string; familyKeys: string[] }>(
    "admin-web-set-category-families",
    { slug, familyKeys },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, slug: r.data.slug, familyKeys: r.data.familyKeys ?? familyKeys };
}
