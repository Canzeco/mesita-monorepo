// Re-pick Mesita Families on live places (MESITA-4238).
//
// Description runs only on Create and Enrich, so a better family prompt fixes
// nothing already stored. This module re-runs the families part of that prompt
// alone, on the texts a place already has, and writes through one database
// door, `admin_repick_family_keys`, which compares and writes in one
// transaction and records the old and new lists for undo.
//
//   page / eval ──> admin-web-repick-families ──> runRepick
//                     (admin JWT or service role)   ├─ read a batch (id > cursor)
//                                                   ├─ skip: owned · generating · category_disabled
//                                                   ├─ model call (25 s, in parallel)
//                                                   ├─ pickFamilies ──> kept (no_usable_reply | unchanged)
//                                                   └─ RPC ──> written | owned | generating | stale
//
// dryRun never writes: without place_ids it counts what a run would touch;
// with place_ids it returns each place's proposed families (the eval's arms).
// It never writes null: hiding a place is not a families fix.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchPlaceFamilies } from "./categories.ts";
import { openaiChat, QUALITY_MODEL } from "./enrich-config.ts";
import { loadEnrichConfig } from "./enrich-config.ts";
import { synthesisModelFor } from "./enrich-synthesis.ts";
import {
  familiesRule,
  familyHintLine,
  familyVocabularyLines,
  mainGoogleCategory,
  pickFamilies,
} from "./families-infer.ts";
import { readOperatorFields } from "./operator-fields.ts";

export type RepickArm = "repick" | "enrich";
export type RepickSource = "repick-families" | "repick-families-agent";

export type RepickRequest = {
  dryRun: boolean;
  arm: RepickArm;
  model: string | null;
  placeIds: string[] | null;
  cursor: string | null;
  batch: number;
  runId: string;
};

export type RepickOutcome =
  | { outcome: "written" }
  | { outcome: "skipped"; reason: "owned" | "generating" | "stale" | "category_disabled" | "missing" }
  | { outcome: "kept"; reason: "no_usable_reply" | "unknown_slug" | "unchanged" }
  | { outcome: "failed"; reason: "rate_limited" | "model_error" | "timeout" | "db_error"; error: string }
  | { outcome: "proposed" };

export type RepickRow = {
  place_id: string;
  name: string;
  main_category: string | null;
  before: string[] | null;
  after: string[] | null;
} & RepickOutcome;

export const BATCH_DEFAULT = 5;
export const BATCH_MAX = 10;
export const PLACE_IDS_MAX = 50;
export const CALL_TIMEOUT_MS = 25_000;
const ERROR_MAX = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The synthesis models a dry run may override with: Models config's own. */
export function allowedModels(): string[] {
  return [...new Set(Object.values(QUALITY_MODEL))];
}

/** Parse and validate a request body; a string is the 400's detail. Pure. */
export function parseRepickRequest(body: unknown, newRunId: () => string): RepickRequest | string {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const dryRun = b.dryRun === true;
  const arm = b.arm === undefined ? "repick" : b.arm;
  if (arm !== "repick" && arm !== "enrich") return "arm must be repick or enrich";
  if (arm === "enrich" && !dryRun) return "the enrich arm is dry-run only";
  let model: string | null = null;
  if (b.model !== undefined && b.model !== null) {
    if (!dryRun) return "model may be set on a dry run only";
    if (typeof b.model !== "string" || !allowedModels().includes(b.model)) {
      return `model must be one of: ${allowedModels().join(", ")}`;
    }
    model = b.model;
  }
  let placeIds: string[] | null = null;
  if (b.place_ids !== undefined && b.place_ids !== null) {
    if (!Array.isArray(b.place_ids) || b.place_ids.length === 0 || b.place_ids.length > PLACE_IDS_MAX) {
      return `place_ids must be 1–${PLACE_IDS_MAX} ids`;
    }
    if (!b.place_ids.every((id) => typeof id === "string" && UUID.test(id))) return "place_ids must be uuids";
    placeIds = [...new Set(b.place_ids as string[])];
  }
  let cursor: string | null = null;
  if (b.cursor !== undefined && b.cursor !== null) {
    if (typeof b.cursor !== "string" || !UUID.test(b.cursor)) return "cursor must be a place uuid";
    cursor = b.cursor;
  }
  let batch = BATCH_DEFAULT;
  if (b.batch !== undefined) {
    if (typeof b.batch !== "number" || !Number.isInteger(b.batch) || b.batch < 1 || b.batch > BATCH_MAX) {
      return `batch must be 1–${BATCH_MAX}`;
    }
    batch = b.batch;
  }
  const runId = typeof b.run_id === "string" && b.run_id.trim() ? b.run_id.trim().slice(0, 64) : newRunId();
  return { dryRun, arm, model, placeIds, cursor, batch, runId };
}

/** A provider error as the page may see it: short, no request ids or keys. Pure. */
export function sanitizeError(raw: string): string {
  return raw
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[key]")
    .replace(/req_[A-Za-z0-9]{6,}/g, "[request]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ERROR_MAX);
}

/** Two lists hold the same families, order aside. Pure. */
export function sameFamilies(a: readonly string[] | null, b: readonly string[] | null): boolean {
  if (!a || !b) return a === b;
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

type PlaceSnapshot = {
  id: string;
  name: string;
  googleTypes: string[];
  category: string | null;
  familyKeys: string[] | null;
  texts: { description: string; pitch: string; story: string };
  operatorOwned: boolean;
  generating: boolean;
};

const AMENITY_LINE =
  "The texts below were written earlier by a model that over-picked families. " +
  "Amenity words in them (family-friendly, kids, cocktails, beer, live music, " +
  "open late, great views) are not evidence for a family; judge what the place IS. " +
  "A place whose name or Google categories make it a bar, pub or cantina is still Bar.";

/** The two messages one re-pick (or one Enrich-arm replay) sends. Pure. */
export function buildRepickMessages(
  place: Pick<PlaceSnapshot, "name" | "googleTypes" | "category" | "texts">,
  familyLines: readonly string[],
  arm: RepickArm,
): { system: string; user: string } {
  const system =
    "You pick Mesita Families for one place. Return ONE JSON object: " +
    '{"families":["<slugs from the FAMILY LIST>"]}. ' +
    familiesRule("enrich") +
    (arm === "repick" ? ` ${AMENITY_LINE}` : "");
  const hint = familyHintLine(place.googleTypes, place.category);
  const texts = [
    place.texts.description ? `Presentation: ${place.texts.description}` : "",
    place.texts.pitch ? `Google summary: ${place.texts.pitch}` : "",
    place.texts.story ? `Story: ${place.texts.story}` : "",
  ].filter(Boolean).join("\n\n");
  const user =
    `FAMILY LIST:\n${familyLines.join("\n")}\n` +
    (hint ? `${hint}\n` : "") +
    `\nPlace: ${place.name}\n` +
    (place.googleTypes.length ? `Google categories: ${place.googleTypes.join(", ")}\n` : "") +
    (texts ? `\n${texts}` : "\n(No stored text; judge from the name and Google categories.)");
  return { system, user };
}

function textOf(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function slugList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
}

const PLACE_SELECT =
  "id, google_name, name, google_types, category, family_keys, description, pitch, story, enrichment_sources, places!inner(content_state)";

function snapshot(row: Record<string, unknown>): PlaceSnapshot {
  const places = row.places as { content_state?: unknown } | { content_state?: unknown }[] | null;
  const state = Array.isArray(places) ? places[0]?.content_state : places?.content_state;
  return {
    id: String(row.id),
    name: textOf(row.name) || textOf(row.google_name) || "(unnamed)",
    googleTypes: slugList(row.google_types),
    category: textOf(row.category) || null,
    familyKeys: Array.isArray(row.family_keys) ? slugList(row.family_keys) : null,
    texts: { description: textOf(row.description), pitch: textOf(row.pitch), story: textOf(row.story) },
    operatorOwned: readOperatorFields(row.enrichment_sources).includes("family_keys"),
    generating: state === "generating",
  };
}

async function enabledCategories(admin: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await admin.from("catalog_membership").select("slug").eq("enabled", true);
  if (error) throw new Error(`catalog_membership: ${error.message}`);
  return new Set((data ?? []).map((r) => String((r as { slug: unknown }).slug)));
}

/** Why a place is not sent to the model, or null. Pure. */
export function preSkip(
  p: Pick<PlaceSnapshot, "operatorOwned" | "generating" | "googleTypes" | "category">,
  enabled: ReadonlySet<string>,
): "owned" | "generating" | "category_disabled" | null {
  if (p.operatorOwned) return "owned";
  if (p.generating) return "generating";
  const main = mainGoogleCategory(p.googleTypes, p.category);
  if (!main || !enabled.has(main)) return "category_disabled";
  return null;
}

/** A model reply (or failure) to an outcome, before the write. Pure. */
export function classifyReply(
  reply: { ok: true; parsed: unknown } | { ok: false; status: number; error: string },
  before: string[] | null,
  pick: (raw: unknown) => string[] | null,
): { after: string[] } | RepickOutcome {
  if (!reply.ok) {
    if (reply.status === 429) return { outcome: "failed", reason: "rate_limited", error: sanitizeError(reply.error) };
    if (reply.status === 408) return { outcome: "failed", reason: "timeout", error: sanitizeError(reply.error) };
    return { outcome: "failed", reason: "model_error", error: sanitizeError(reply.error) };
  }
  const raw = (reply.parsed as { families?: unknown } | null)?.families;
  const after = pick(raw);
  if (!after) {
    const named = Array.isArray(raw) && raw.some((x) => typeof x === "string" && x.trim());
    return { outcome: "kept", reason: named ? "unknown_slug" : "no_usable_reply" };
  }
  if (sameFamilies(before, after)) return { outcome: "kept", reason: "unchanged" };
  return { after };
}

async function askModel(
  openaiKey: string,
  model: string,
  messages: { system: string; user: string },
): Promise<{ ok: true; parsed: unknown } | { ok: false; status: number; error: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await openaiChat({
      key: openaiKey,
      model,
      json: true,
      temperature: 0.2,
      signal: ctl.signal,
      messages: [
        { role: "system", content: messages.system },
        { role: "user", content: messages.user },
      ],
    });
    if (!res.ok) {
      // openaiChat catches its own throws: an abort comes back as status null.
      const r = res as { status?: number | null; errorBody?: string; error?: unknown };
      const aborted = ctl.signal.aborted;
      return {
        ok: false,
        status: aborted ? 408 : r.status ?? 0,
        error: aborted ? "timed out" : r.errorBody ?? String(r.error ?? "model call failed"),
      };
    }
    return { ok: true, parsed: res.parsed };
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    return { ok: false, status: aborted ? 408 : 0, error: aborted ? "timed out" : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

export type RepickResult = {
  ok: true;
  run_id: string;
  dry_run: boolean;
  arm: RepickArm;
  model: string;
  rows: RepickRow[];
  counts: Record<string, number>;
  next_cursor: string | null;
  done: boolean;
  total?: number;
};

/** One call's worth of work: a dry-run count, a proposal set, or one live batch. */
export async function runRepick(
  admin: SupabaseClient,
  req: RepickRequest,
  ctx: { openaiKey: string; source: RepickSource; actor: string | null },
): Promise<RepickResult> {
  const cfg = await loadEnrichConfig(admin);
  const model = req.model ?? synthesisModelFor(cfg.synthesisQuality);
  const [familyVocab, enabled] = await Promise.all([fetchPlaceFamilies(admin), enabledCategories(admin)]);
  const familyLines = familyVocabularyLines(familyVocab);
  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);

  // Whole-catalog dry run: what a run would touch, no model calls.
  if (req.dryRun && !req.placeIds) {
    const { data, error } = await admin.from("place_profiles").select(PLACE_SELECT).order("id");
    if (error) throw new Error(`place_profiles: ${error.message}`);
    const all = (data ?? []).map((r) => snapshot(r as Record<string, unknown>));
    for (const p of all) bump(preSkip(p, enabled) ?? "to_process");
    return {
      ok: true, run_id: req.runId, dry_run: true, arm: req.arm, model, rows: [], counts,
      next_cursor: null, done: true, total: all.length,
    };
  }

  let query = admin.from("place_profiles").select(PLACE_SELECT).order("id");
  if (req.placeIds) query = query.in("id", req.placeIds);
  else {
    if (req.cursor) query = query.gt("id", req.cursor);
    query = query.limit(req.batch);
  }
  const { data, error } = await query;
  if (error) throw new Error(`place_profiles: ${error.message}`);
  const places = (data ?? []).map((r) => snapshot(r as Record<string, unknown>));

  const pick = (raw: unknown) => pickFamilies(raw, familyVocab);
  const rows = await Promise.all(places.map(async (p): Promise<RepickRow> => {
    const base = { place_id: p.id, name: p.name, main_category: mainGoogleCategory(p.googleTypes, p.category), before: p.familyKeys };
    const skip = req.dryRun ? null : preSkip(p, enabled);
    if (skip) return { ...base, after: null, outcome: "skipped", reason: skip };
    const reply = await askModel(ctx.openaiKey, model, buildRepickMessages(p, familyLines, req.arm));
    const verdict = classifyReply(reply, p.familyKeys, pick);
    if (!("after" in verdict)) {
      // A dry run still shows what the model proposed when it proposed the same list.
      if (req.dryRun && verdict.outcome === "kept" && verdict.reason === "unchanged") {
        return { ...base, after: p.familyKeys, outcome: "proposed" };
      }
      return { ...base, after: null, ...verdict };
    }
    if (req.dryRun) return { ...base, after: verdict.after, outcome: "proposed" };
    const { data: answer, error: rpcError } = await admin.rpc("admin_repick_family_keys", {
      p_place: p.id,
      p_before: p.familyKeys,
      p_after: verdict.after,
      p_run_id: req.runId,
      p_actor: ctx.actor,
      p_source: ctx.source,
    });
    if (rpcError) {
      return { ...base, after: verdict.after, outcome: "failed", reason: "db_error", error: sanitizeError(`${rpcError.code ?? ""} ${rpcError.message}`) };
    }
    if (answer === "written") return { ...base, after: verdict.after, outcome: "written" };
    const reason = answer === "owned" || answer === "generating" || answer === "stale" || answer === "missing" ? answer : "stale";
    return { ...base, after: null, outcome: "skipped", reason };
  }));

  for (const r of rows) bump("reason" in r ? `${r.outcome}:${r.reason}` : r.outcome);
  const last = places.at(-1)?.id ?? null;
  const done = req.placeIds ? true : places.length < req.batch;
  return {
    ok: true, run_id: req.runId, dry_run: req.dryRun, arm: req.arm, model, rows, counts,
    next_cursor: done ? null : last, done,
  };
}
