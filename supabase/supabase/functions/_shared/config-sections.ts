// _shared/config-sections.ts — THE registry of admin config sections.
//
// Ten jsonb columns on the public.app_config singleton, one per admin console
// page, reached through exactly two edge functions (MESITA-1724):
//
//   POST admin-web-get-config     { }                  -> the Intake payload
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
import { normalizeControlsConfig } from "./controls-config.ts";
import { normalizeDiscoveryConfig } from "./discovery-config.ts";
import { normalizeEnrichmentConfig } from "./enrichment-config.ts";
import { normalizeOjoConfig } from "./ojo-config.ts";
import { normalizeOrdersConfig } from "./orders-config.ts";
import { normalizeVerificationConfig } from "./verification-config.ts";
import { normalizeVisitsConfig } from "./visits-config.ts";
import { writeEnricherSection } from "./config-section-enricher.ts";
import { readModelsSection, writeModelsSection } from "./config-section-models.ts";
import {
  readReservationsSection,
  writeReservationsSection,
} from "./config-section-reservations.ts";
import {
  pickPromosBlob,
  readRewardsSection,
  writeRewardsSection,
} from "./config-section-rewards.ts";
import { writeVerificationSection } from "./config-section-verification.ts";

/** Raw jsonb through unchanged — the section's client owns the coercion. */
const asIs = (raw: unknown): unknown => raw ?? null;

export const CONFIG_SECTIONS: Record<string, ConfigSection> = {
  // ── Uniform: read the column, write the whole blob back ──────────────────
  // The Wallet's Credits policy — the hold a place inherits when it sets none,
  // the bonus that goes with it, the ceiling on a per-place hold, and how long
  // unspent Credits live. Whether Credits may settle a bill is visits.payCredits.
  controls: { column: "controls_config", normalize: normalizeControlsConfig },
  // The ranking model: one exponent per earned signal, plus the bought slot
  // lane. The signal vocabulary is code-defined; this serves numbers, never
  // the list.
  discovery: { column: "discovery_config", normalize: normalizeDiscoveryConfig },
  // Ojo's proof-verification policy (MESITA-1034). `enabled` defaults off.
  ojo: { column: "ojo_config", normalize: normalizeOjoConfig },
  // The REMOTE context's policy. The rail is parked, so every knob is STAGED.
  orders: { column: "orders_config", normalize: normalizeOrdersConfig },
  // The LOCAL context's policy — the knobs THE TICKET runs on (tips, poll
  // cadence, proof, send-backs, pay rails, abandonment).
  visits: { column: "visits_config", normalize: normalizeVisitsConfig },

  // ── Own write: the validation the generic path cannot express ────────────
  // Flat body, per-key merge, ranged knobs and the image-funnel lock.
  enricher: {
    column: "enrichment_config",
    normalize: normalizeEnrichmentConfig,
    write: writeEnricherSection,
  },
  // Read-merge-write: the console flips one switch at a time.
  verification: {
    column: "verification_config",
    normalize: normalizeVerificationConfig,
    write: writeVerificationSection,
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
  // The v12 key inside promos_config, plus the cap scalar; a stale v10/v11
  // save is a 409.
  rewards: {
    column: "promos_config",
    normalize: pickPromosBlob,
    read: readRewardsSection,
    write: writeRewardsSection,
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
