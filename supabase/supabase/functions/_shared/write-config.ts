// _shared/write-config.ts
//
// THE app_config door. Every read and every write of the settings singleton
// that the admin console drives goes through these two functions, so there is
// exactly one `.from("app_config")` chain behind the whole config surface and
// the write-surface ratchet has one name to allow.
//
// This file used to be a generic wrapper with no callers, written against the
// day the scattered config writers would be migrated onto it (MESITA-1248 was
// expected to restructure app_config first). MESITA-1724 is that migration:
// twenty edge functions collapsed into admin-web-get-config +
// admin-web-update-config, dispatching through _shared/config-sections.ts,
// which reads and writes here.
//
// Both helpers take the column list verbatim so a section can select or patch
// whatever it owns — the enricher touches two columns, models wants no
// updated_at. Neither adds `updated_by`: the caller owns the patch.
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { jsonError } from "./http.ts";

/** One app_config row, keyed by whichever columns the caller selected. */
export type AppConfigRow = Record<string, unknown>;

export type ConfigRowResult =
  | { ok: true; row: AppConfigRow | null }
  | { ok: false; response: Response };

/**
 * Read the singleton. `row` is null only when the row itself is missing, which
 * the migrations make impossible — each caller decides whether that is a 500
 * or a default, exactly as it did before the collapse.
 */
export async function readAppConfig(
  admin: SupabaseClient,
  columns: string,
  errorPrefix: string,
): Promise<ConfigRowResult> {
  const { data, error } = await admin
    .from("app_config")
    .select(columns)
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      response: jsonError(`${errorPrefix}: ${error.message}`, 500),
    };
  }
  return { ok: true, row: (data ?? null) as AppConfigRow | null };
}

/**
 * Patch the singleton and hand back the columns named in `columns`. `.single()`
 * on the way out, so a write that matched no row surfaces as a 500 rather than
 * a success with nothing saved.
 */
export async function writeAppConfig(
  admin: SupabaseClient,
  patch: Record<string, unknown>,
  columns: string,
  errorPrefix: string,
): Promise<{ ok: true; row: AppConfigRow } | { ok: false; response: Response }> {
  const { data, error } = await admin
    .from("app_config")
    .update(patch)
    .eq("id", 1)
    .select(columns)
    .single();
  if (error) {
    return {
      ok: false,
      response: jsonError(`${errorPrefix}: ${error.message}`, 500),
    };
  }
  return { ok: true, row: data as unknown as AppConfigRow };
}
