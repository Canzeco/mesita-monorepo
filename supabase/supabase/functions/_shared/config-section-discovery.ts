// _shared/config-section-discovery.ts — the Discovery page's write
// (MESITA-4454).
//
// Two guards the generic whole-blob write cannot give:
//
// 1. NO SAVE ERASES WHAT IT DID NOT SEND (H-2). The stored `params` and `map`
//    are the base and the console's are laid over them key by key, so a
//    console that predates a key (an older build without `params.recipes` or
//    `params.mix`) or a card that sends one slice never deletes another
//    card's keys. The normalizer then rebuilds the typed keys and keeps the
//    rest (`normalizeDiscoveryConfig`).
// 2. A STALE PAGE CANNOT OVERWRITE A NEWER SAVE (H-3, DX-g). With
//    `expectedUpdatedAt` (the `updatedAt` the page loaded) the write is
//    `update … where id = 1 and updated_at = $expected`; zero rows is 409
//    `{ ok: false, code: "config_conflict", error: "config changed, reload" }`.
//    Without it the write is unconditional, as before (older consoles).
//
// Answer: `{ ok, config, updatedAt }`, the saved config normalized.
import { asRecord } from "./config-coerce.ts";
import { jsonError, jsonOk } from "./http.ts";
import { readAppConfig, writeAppConfig } from "./write-config.ts";
import {
  appConfigMissing,
  type ConfigSection,
  type SectionWriteContext,
} from "./config-section-base.ts";

/** The stored blob with the incoming one laid over it: top-level keys
 *  replace, `params` and `map` merge one level down. */
export function mergeDiscoveryWrite(stored: unknown, incoming: unknown): Record<string, unknown> {
  const s = asRecord(stored);
  const i = asRecord(incoming);
  return {
    ...s,
    ...i,
    params: { ...asRecord(s.params), ...asRecord(i.params) },
    map: { ...asRecord(s.map), ...asRecord(i.map) },
  };
}

export async function writeDiscoverySection(
  ctx: SectionWriteContext,
  section: ConfigSection,
): Promise<Response> {
  const expected = ctx.body.expectedUpdatedAt;
  if (expected !== undefined && expected !== null && typeof expected !== "string") {
    return jsonError("expectedUpdatedAt must be the updatedAt string the page loaded", 400);
  }
  const cur = await readAppConfig(ctx.admin, `${section.column}, updated_at`, `${section.column}_read`);
  if (!cur.ok) return cur.response;
  if (!cur.row) return appConfigMissing();
  const next = section.normalize(mergeDiscoveryWrite(cur.row[section.column], ctx.body.config));
  const res = await writeAppConfig(
    ctx.admin,
    { [section.column]: next, updated_by: ctx.userId },
    `${section.column}, updated_at`,
    `${section.column}_update`,
    typeof expected === "string" ? { expectedUpdatedAt: expected } : {},
  );
  if (!res.ok) return res.response;
  return jsonOk({
    config: section.normalize(res.row[section.column]),
    updatedAt: res.row.updated_at,
  });
}
