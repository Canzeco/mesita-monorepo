// Operator-owned fields (MESITA-2829) — the other durable mark in
// `enrichment_sources`, beside the 90-day pins of enrich-corrections.ts.
//
// Basics has four fields the Description step infers on Create and every
// Enrich AND the operator may edit: the Mesita name, the Presentation, the
// Mesita tags and, since MESITA-2893, the Mesita families. An operator edit
// must stick: the next Enrich would otherwise overwrite it with a fresh
// inference, silently. So an accepted edit of one of these records the field
// in `enrichment_sources.operator_fields`, and every Enrich write — and the
// name door — skips a field listed there. Unlike a pin, a mark never expires:
// only the operator's Reset (per row on Single Place › Basics) clears it, and
// the next Enrich infers again.
//
// A cleared field is not owned: blanking the name (it follows Google again),
// the Presentation, the tags or the families records nothing, so Enrich may
// refill it.
//
// The bag is rebuilt wholesale by the paused stage path (S8), so like the
// pins the marks must be carried forward explicitly (`withOperatorFields`).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { writePlace } from "./place-doc.ts";

export type OperatorField = "name" | "description" | "tags" | "family_keys";

export const OPERATOR_FIELDS: readonly OperatorField[] = [
  "name",
  "description",
  "tags",
  "family_keys",
];

/** Where inside `enrichment_sources` the marks live. */
export const OPERATOR_FIELDS_KEY = "operator_fields";

export function isOperatorField(v: unknown): v is OperatorField {
  return typeof v === "string" && (OPERATOR_FIELDS as string[]).includes(v);
}

/** The marked fields on a live `enrichment_sources` value; junk reads as none. */
export function readOperatorFields(enrichmentSources: unknown): OperatorField[] {
  if (!enrichmentSources || typeof enrichmentSources !== "object") return [];
  const raw = (enrichmentSources as Record<string, unknown>)[OPERATOR_FIELDS_KEY];
  if (!Array.isArray(raw)) return [];
  return OPERATOR_FIELDS.filter((f) => raw.includes(f));
}

/** Fold the marks into a (rebuilt) `enrichment_sources` blob; none ⇒ no key. */
export function withOperatorFields(
  sources: Record<string, unknown>,
  fields: readonly OperatorField[],
): Record<string, unknown> {
  const { [OPERATOR_FIELDS_KEY]: _drop, ...rest } = sources;
  const kept = OPERATOR_FIELDS.filter((f) => fields.includes(f));
  return kept.length > 0 ? { ...rest, [OPERATOR_FIELDS_KEY]: kept } : rest;
}

/**
 * Which operator fields a save patch claims: a non-empty value. A null name
 * or Presentation and an empty tag or family list are a clearing, not an
 * edit.
 */
export function operatorFieldsInPatch(patch: Record<string, unknown>): OperatorField[] {
  const out: OperatorField[] = [];
  for (const field of OPERATOR_FIELDS) {
    if (!(field in patch)) continue;
    const v = patch[field];
    const owned = field === "tags" || field === "family_keys"
      ? Array.isArray(v) && v.length > 0
      : typeof v === "string" && v.trim() !== "";
    if (owned) out.push(field);
  }
  return out;
}

/**
 * Drop every operator-owned column from an Enrich update, so the run writes
 * around the operator's words instead of over them. Absent keys are not
 * "skipped": the persist contract leaves them untouched anyway.
 */
export function stripOperatorFields<T extends Record<string, unknown>>(
  update: T,
  owned: readonly OperatorField[],
): { update: Record<string, unknown>; skipped: OperatorField[] } {
  const out: Record<string, unknown> = { ...update };
  const skipped: OperatorField[] = [];
  for (const field of OPERATOR_FIELDS) {
    if (owned.includes(field) && field in out) {
      delete out[field];
      skipped.push(field);
    }
  }
  return { update: out, skipped };
}

/**
 * Record an operator's edits and clear their Resets on the live row, in one
 * read-merge-write. `mark` wins over `clear` for a field in both.
 */
export async function markOperatorFields(
  admin: SupabaseClient,
  placeId: string,
  change: { mark: readonly OperatorField[]; clear: readonly OperatorField[] },
): Promise<{ ok: true; fields: OperatorField[] } | { ok: false; error: string }> {
  const { data: row, error: readErr } = await admin
    .from("place_profiles")
    .select("enrichment_sources")
    .eq("id", placeId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!row) return { ok: false, error: "place_profiles row missing" };
  const rawSources = (row as { enrichment_sources?: unknown }).enrichment_sources;
  const sources = rawSources && typeof rawSources === "object"
    ? { ...(rawSources as Record<string, unknown>) }
    : {};
  const before = readOperatorFields(sources);
  const after = OPERATOR_FIELDS.filter((f) =>
    change.mark.includes(f) || (before.includes(f) && !change.clear.includes(f))
  );
  if (after.join() === before.join()) return { ok: true, fields: after };
  const res = await writePlace(admin, {
    table: "place_profiles",
    mode: "update",
    id: placeId,
    patch: { enrichment_sources: withOperatorFields(sources, after) },
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, fields: after };
}
