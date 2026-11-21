"use server";

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";
import type { FamiliesMap, FieldLimits } from "./highlight";

export async function getFamiliesMap(): Promise<ActionResult<FamiliesMap & { limits: FieldLimits | null }>> {
  const r = await efInvoke<FamiliesMap & { ok: boolean; limits?: FieldLimits }>("admin-web-get-families", {});
  if (!r.ok) return { ok: false, error: r.error };
  if (!r.data.families?.length) {
    return { ok: false, error: "Families did not load." };
  }
  return {
    ok: true,
    families: r.data.families,
    enabledCategories: r.data.enabledCategories ?? [],
    disabledCategories: r.data.disabledCategories ?? [],
    tags: r.data.tags ?? [],
    limits: r.data.limits ?? null,
  };
}

/** The six Atlas limits as the `enricher` config section takes them (MESITA-4581). */
export type FieldLimitsPatch = {
  createFamiliesMax?: number;
  enrichFamiliesMax?: number;
  createPresentationMaxChars?: number;
  enrichPresentationMaxChars?: number;
  createTagsMax?: number;
  enrichTagsMax?: number;
};

export async function saveFieldLimits(patch: FieldLimitsPatch): Promise<ActionResult<{ saved: true }>> {
  const r = await efInvoke<Record<string, unknown>>("admin-web-update-config", { section: "enricher", ...patch });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, saved: true };
}
