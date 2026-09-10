// _shared/config-section-rewards.ts — the `rewards` section's read and write.
//
// Was admin-web-get-rewards-config / admin-web-update-rewards-config
// (MESITA-1724 collapse). The Promos config lives as the `v12` key inside
// app_config.promos_config, alongside the cap scalar and the legacy v13
// grid/actions fallback — so neither direction is a plain column read or a
// plain column replace, which is why both are handlers of their own.
//
// READ: the v12 ADDITIVE blob (MESITA-1705) when one has been saved (a
// leftover v10/v11 blob is handed back as-is and the client migrates it), plus
// the cap scalar. Before the first save there is no blob, only the cap, and the
// client opens on the launch defaults carrying it. The v8 legacy rule rows are
// gone with the reward_rules table: the blob is the one store, so there is
// nothing left to reconcile it against.
//
// WRITE: the payload is the CONTEXT × CLASS Promos config — visits (base:
// strategy × class, + bonuses), orders (base: strategy alone, + bonuses,
// parked) and the default cap. The PLAN axis is gone: a reward is base +
// welcome + class + actions, and nothing the guest pays for moves it. It is
// written as the `v12` key, MERGE-preserving the blob's other keys. A
// WHOLE-BLOB write: the caller always sends the complete config and
// normalizePromos always returns a complete one.
//
// The superseded `v10` and `v11` keys are DELETED on every v12 save so there
// is exactly one additive source of truth. A v10- or v11-shaped SAVE is
// REFUSED (409): only a stale tab can produce one, it is showing bundled
// defaults rather than the live blob, and accepting it would overwrite every
// live rate — a v11 tab would also reinstate the plan axis v12 removed. Reads
// still migrate both — a restored app_config row may hold either.
//
// MESITA-992: the LIVE bill prices additive from the config. The reward_rules
// mirror table is gone (20260818090000_drop_coupons_and_dead_columns.sql) —
// the config priced every ticket long before it was dropped — so a save now
// writes the blob alone, refreshing the legacy v13 grid/actions keys it
// carries as the engine's last-resort fallback.
//
// A legacy {rules, cap} body still writes through the v8 path unchanged.
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { jsonError, jsonOk } from "./http.ts";
import { readAppConfig, writeAppConfig } from "./write-config.ts";
import type { ConfigSection, SectionWriteContext } from "./config-section-base.ts";
import { normalizeRewards, type RewardRule } from "./rewards-config-normalize.ts";
import {
  legacyRulesFromV12,
  normalizePromos,
  promosWriteShape,
  type PromosConfigV12,
} from "./promos-normalize.ts";

function isBlob(v: unknown): boolean {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * The additive config inside the promos blob — null until the first save, in
 * which case the client seeds from the launch defaults. A leftover v10 or v11
 * blob is handed back as-is and the client migrates it (coercePromosConfig), so
 * the page opens on the operator's real numbers rather than the defaults.
 *
 * NEWEST KEY WINS, and the order matters: a save writes v12 and deletes the
 * older keys, but a blob restored from backup mid-cutover can carry two at
 * once. Reading v11 first there would hand the console a superseded grid and it
 * would save it straight back over the live one.
 */
export function pickPromosBlob(raw: unknown): unknown {
  const cfg = (raw ?? {}) as Record<string, unknown>;
  if (isBlob(cfg.v12)) return cfg.v12;
  if (isBlob(cfg.v11)) return cfg.v11;
  if (isBlob(cfg.v10)) return cfg.v10;
  return null;
}

// Fold the rules into the v13 blob shape. Belt and braces: loadRewardsGrid
// prefers v12, then falls back to these blob keys.
function blobFromRules(
  rules: RewardRule[],
  cap: number,
): Record<string, unknown> {
  const grid: Record<string, Record<string, number>> = {};
  const actions: Record<string, Record<string, Record<string, number>>> = {};

  for (const r of rules) {
    if (r.action === "standing") {
      grid[r.class] ??= { zero: 0 };
      grid[r.class][r.strategy] = r.discount_percent;
      continue;
    }
    actions[r.action] ??= {};
    actions[r.action][r.class] ??= { zero: 0 };
    actions[r.action][r.class][r.strategy] = r.discount_percent;
  }

  return { grid, actions, cap };
}

export async function readRewardsSection(
  admin: SupabaseClient,
  section: ConfigSection,
): Promise<Response> {
  const res = await readAppConfig(
    admin,
    `${section.column}, updated_at`,
    section.readError ?? `${section.column}_read`,
  );
  if (!res.ok) return res.response;

  const cfg = (res.row?.[section.column] ?? {}) as Record<string, unknown>;
  const cap = typeof cfg.cap === "number" ? cfg.cap : null;

  // One store, so one "Updated" stamp.
  const stamp = res.row?.updated_at as string | null | undefined;
  const updatedAt = typeof stamp === "string" ? stamp : null;

  return jsonOk({ config: pickPromosBlob(cfg), cap, updatedAt });
}

export async function writeRewardsSection(
  ctx: SectionWriteContext,
  section: ConfigSection,
): Promise<Response> {
  const body = ctx.body as { rules?: unknown; cap?: unknown; config?: unknown };

  // v12 body: {config: {version: 12, visits, orders, cap}}. Anything else
  // falls through to the legacy v8 {rules, cap} path.
  const rawConfig = body.config;
  const shape = promosWriteShape(rawConfig);

  // A v10 or v11 SAVE is refused outright. Nothing shipped writes either any
  // more, so it can only be a stale tab whose bundle predates the v12
  // migration — and such a tab cannot parse the live blob, so it is displaying
  // its own bundled DEFAULTS. Letting it through would overwrite every live
  // rate with those defaults, silently, on a single click; a v11 tab would
  // additionally write back the plan axis v12 deleted. Reads still migrate
  // both (see promosWriteShape); only writes are closed.
  //
  // Logged, not just refused: to the operator a refused save looks like a
  // no-op click, so the version that was rejected has to be recoverable from
  // the logs when they ask why nothing saved.
  if (shape === "stale-v10" || shape === "stale-v11") {
    console.warn(
      `rewards-config: refused a stale ${
        shape.slice(6)
      } save from user ${ctx.userId}`,
    );
    return jsonError(
      "This page is out of date — reload it before saving. It is showing " +
        "default rates, not the live ones, and saving would overwrite them.",
      409,
    );
  }

  let rules: RewardRule[];
  let cap: number;
  let promosConfig: PromosConfigV12 | null = null;

  if (shape === "v12") {
    const norm = normalizePromos(rawConfig);
    if (!norm.ok) return jsonError(norm.error, 400);
    promosConfig = norm.value;
    rules = legacyRulesFromV12(norm.value);
    cap = norm.value.cap;
  } else {
    const payload = body.rules !== undefined || body.cap !== undefined
      ? body
      : body.config;
    const norm = normalizeRewards(payload);
    if (!norm.ok) return jsonError(norm.error, 400);
    rules = norm.value.rules;
    cap = norm.value.cap;
  }

  // MERGE-preserve the blob: the v13 grid/actions fallback and the cap are
  // refreshed, v12 is written on a config save, and any other keys riding the
  // blob survive untouched.
  const current = await readAppConfig(
    ctx.admin,
    section.column,
    `${section.column}_read`,
  );
  if (!current.ok) return current.response;
  const existing = (current.row?.[section.column] ?? {}) as Record<
    string,
    unknown
  >;

  const nextBlob: Record<string, unknown> = {
    ...existing,
    ...blobFromRules(rules, cap),
    ...(promosConfig ? { v12: promosConfig } : {}),
  };
  // One additive source of truth: v12 supersedes both older keys outright, so
  // they are dropped rather than left to drift behind the live config.
  if (promosConfig) {
    delete nextBlob.v10;
    delete nextBlob.v11;
  }

  const saved = await writeAppConfig(
    ctx.admin,
    { [section.column]: nextBlob, updated_by: ctx.userId },
    "updated_at",
    "rewards_cap_update",
  );
  if (!saved.ok) return saved.response;

  return jsonOk({
    config: promosConfig,
    rules,
    cap,
    updatedAt: saved.row.updated_at,
  });
}
