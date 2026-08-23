// _shared/write-config.ts
//
// Thin generic CONFIG write door. app_config's 13 writers repeat the same
// `update({[column]: value}).eq("id", 1)` statement against 8 jsonb columns
// that already have working normalizers (reservations-config-normalize.ts,
// promos-v11-normalize.ts, rewards-config-normalize.ts, etc.) — this is a
// wrapper, not a rewrite of those normalizers. Migrating the 13 existing
// callers onto this door is optional/P2 (MESITA-1248 is about to restructure
// app_config anyway); this PR ships the door + the CI ratchet only.
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

type NormalizeFn<T> = (raw: unknown) => { ok: true; value: T } | { ok: false; error: string };

export async function writeConfig<T>(
  admin: SupabaseClient,
  column: string, // one of the app_config jsonb columns
  raw: unknown,
  normalize: NormalizeFn<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const parsed = normalize(raw);
  if (!parsed.ok) return parsed;
  const { error } = await admin.from("app_config").update({ [column]: parsed.value }).eq("id", 1);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: parsed.value };
}
