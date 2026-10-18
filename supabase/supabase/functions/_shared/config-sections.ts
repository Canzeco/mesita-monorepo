// _shared/config-sections.ts — THE registry of admin config sections.
//
// Four jsonb columns on the public.app_config singleton, one per admin console
// page, reached through exactly two edge functions (MESITA-1724):
//
//   POST admin-web-get-config     { }                  -> the Crenup payload
//                                 { section: "<key>" } -> that section
//   POST admin-web-update-config  { section: "<key>", … }
//
// Both are thin dispatchers: CORS, method, env, auth, super-admin, look the
// section up here, delegate. Everything a section does that is not "read the
// column / write the column" lives in its own module next to this one, so the
// per-section validation the twenty old functions carried MOVED rather than
// being flattened into one handler or dropped.
//
// The section key is the WIRE contract with apps/web-admin — there is no shared
// type across the package boundary (shared/ mirrors between web apps only, not
// into supabase), so config-section-callers.test.ts scans the console's source
// for these strings in both directions instead.
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { jsonError } from "./http.ts";
import {
  type ConfigSection,
  readSectionColumn,
  type SectionWriteContext,
  writeSectionColumn,
} from "./config-section-base.ts";
import { normalizeDiscoveryConfig } from "./discovery-config.ts";
import { normalizeEnrichmentConfig } from "./enrichment-config.ts";
import { writeEnricherSection } from "./config-section-enricher.ts";
import {
  readModelsSection,
  writeModelsSection,
} from "./config-section-models.ts";
import {
  readReservationsSection,
  writeReservationsSection,
} from "./config-section-reservations.ts";

/** Raw jsonb through unchanged — the section's client owns the coercion. */
const asIs = (raw: unknown): unknown => raw ?? null;


export const CONFIG_SECTIONS: Record<string, ConfigSection> = {
  // ── Uniform: read the column, write the whole blob back ──────────────────
  // The ranking model: one exponent per earned signal. The signal vocabulary
  // is code-defined; this serves numbers, never the list.
  discovery: {
    column: "discovery_config",
    normalize: normalizeDiscoveryConfig,
    write: writeSectionColumn,
  },
  //
  // controls · ojo · orders · visits · rewards left with the admin pages that
  // reached them (MESITA-2088, the MVP First Stage).

  // ── Own write: the validation the generic path cannot express ────────────
  // Flat body, per-key merge, ranged knobs and the image-funnel lock.
  enricher: {
    column: "enrichment_config",
    normalize: normalizeEnrichmentConfig,
    write: writeEnricherSection,
  },

  // ── Own read AND write ───────────────────────────────────────────────────
  // No updatedAt, no normalizer: the raw blob or null, rebuilt on write.
  models: {
    column: "models_config",
    normalize: asIs,
    readError: "models_config_get",
    read: readModelsSection,
    write: writeModelsSection,
  },
  // Read carries the needs-attention feed; write refuses rather than coerces.
  reservations: {
    column: "reservations_config",
    normalize: asIs,
    read: readReservationsSection,
    write: writeReservationsSection,
  },
};

export const CONFIG_SECTION_KEYS: string[] = Object.keys(CONFIG_SECTIONS)
  .sort();

function unknownSection(key: string): Response {
  return jsonError(
    `unknown config section "${key}" — expected one of ${
      CONFIG_SECTION_KEYS.join(", ")
    }`,
    400,
  );
}

/**
 * OWN properties only. `CONFIG_SECTIONS["__proto__"]` and
 * `CONFIG_SECTIONS["constructor"]` are truthy inherited objects, so a plain
 * `if (!section)` would wave them through to a handler with no `column` and
 * answer 500 on a malformed PostgREST select instead of naming the real
 * problem.
 */
function lookup(key: string): ConfigSection | null {
  return Object.hasOwn(CONFIG_SECTIONS, key) ? CONFIG_SECTIONS[key] : null;
}

/** `{ section: "<key>" }` on admin-web-get-config. */
export function readConfigSection(
  admin: SupabaseClient,
  key: string,
): Promise<Response> {
  const section = lookup(key);
  if (!section) return Promise.resolve(unknownSection(key));
  return (section.read ?? readSectionColumn)(admin, section);
}

/** `{ section: "<key>", … }` on admin-web-update-config. */
export function writeConfigSection(
  ctx: SectionWriteContext,
  key: string,
): Promise<Response> {
  const section = lookup(key);
  if (!section) return Promise.resolve(unknownSection(key));
  return (section.write ?? writeSectionColumn)(ctx, section);
}
