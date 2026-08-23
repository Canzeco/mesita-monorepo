// _shared/reservation-attempts.ts
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { nullable, num, object, str, type Infer } from "./doc-schema.ts";
import { normalizeAlternatives } from "./reservation-alternatives.ts";

// Promoted verbatim from supabase-edgefunc-reservation-call/index.ts's local,
// unexported `type AttemptEntry` (was read back with a bare `as` cast at the
// EF's own priorAttempts hydration site). Mechanical promotion, not a
// redesign — do not add, rename, or retype a field here.
export const AttemptEntrySchema = object({
  n: num(),
  started_at: str(),
  conversation_id: nullable(str()),
  result: str(),
});
export type AttemptEntry = Infer<typeof AttemptEntrySchema>;

/**
 * Thin RESERVATION write door. Validates `attempts` (whole-array — every
 * entry must be well-formed, or the write is refused rather than silently
 * dropping the offending entries; unlike the PLACE jsonb schemas, a corrupt
 * attempts array is a bug worth seeing, not LLM noise worth swallowing) and
 * normalizes `alternatives` through the existing, already-tested
 * normalizeAlternatives. Does not touch reservation-call/index.ts's 11
 * existing call sites — see this PR's non-goals.
 */
export async function updateReservation(
  admin: SupabaseClient,
  reservationId: string,
  patch: { attempts?: unknown; alternatives?: unknown } & Record<string, unknown>,
): Promise<{ ok: true; value: { id: string } } | { ok: false; error: string }> {
  const out: Record<string, unknown> = { ...patch };
  if ("attempts" in patch) {
    // MESITA-1247 review fix: `attempts` itself being present-but-not-an-array
    // (a string, a number, a stray object) used to fall back to `[]` here —
    // silently dropping the whole malformed value instead of refusing the
    // write, exactly the "swallowing" behaviour this door's own docstring
    // above says it deliberately does NOT want. Refuse it the same way a
    // malformed ENTRY inside an otherwise-real array already was.
    if (!Array.isArray(patch.attempts)) {
      return { ok: false, error: "attempts must be an array" };
    }
    const value: unknown[] = [];
    for (const entry of patch.attempts) {
      const r = AttemptEntrySchema.parse(entry);
      if (!r.ok) return { ok: false, error: `attempts: ${r.error}` };
      value.push(r.value);
    }
    out.attempts = value;
  }
  if ("alternatives" in patch) {
    out.alternatives = normalizeAlternatives(patch.alternatives);
  }
  const { error } = await admin.from("reservation_tickets").update(out).eq("id", reservationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: { id: reservationId } };
}
