// MESITA-3163: Premier Refill from Manage Multiple › Refill — the body,
// the per-ID lines and the run behind admin-web-grant-place-premier actions
// `refill` and `end_mesita_days`. The days themselves are SQL
// (premier_add_days / premier_end_mesita_days, migration
// 20261103090000_premier_refill.sql); this resolves the Google Place IDs in
// one read (in chunks of ID_CHUNK, the URL's limit), calls one RPC per
// place in-region and answers one line per ID.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { chunked, ID_CHUNK } from "./postgrest.ts";

export const REFILL_MAX_IDS = 500;
export const REFILL_MAX_DAYS = 366;
/** RPCs in flight at once: 500 places finish well under a minute. */
const REFILL_CONCURRENCY = 10;

export type RefillAction = "refill" | "end_mesita_days";

export type RefillRequest =
  | { action: "refill"; googlePlaceIds: string[]; tier: 1 | 2; days: number; requestId: string }
  | { action: "end_mesita_days"; googlePlaceIds: string[] };

export type RefillInvalid = { code: string; error: string };

export type RefillLine = {
  googlePlaceId: string;
  placeId: string | null;
  result: "ok" | "refused" | "unknown";
  code?: string;
  replayed?: boolean;
  ends_at_2x?: string | null;
  ends_at_5x?: string | null;
  ended_days?: number;
};

function quote(v: unknown): string {
  return JSON.stringify(String(v).slice(0, 32));
}

/** Validates a refill / end_mesita_days body. Duplicate IDs are sent once,
 *  in their first position. */
export function parseRefillBody(body: Record<string, unknown>): RefillRequest | RefillInvalid {
  const raw = body.googlePlaceIds;
  if (!Array.isArray(raw) || raw.some((id) => typeof id !== "string" || id.trim() === "")) {
    return { code: "ids_invalid", error: "googlePlaceIds must be a list of Google Place IDs" };
  }
  const googlePlaceIds = [...new Set(raw.map((id) => (id as string).trim()))];
  if (googlePlaceIds.length === 0) {
    return { code: "ids_invalid", error: "googlePlaceIds is empty" };
  }
  if (googlePlaceIds.length > REFILL_MAX_IDS) {
    return { code: "too_many_ids", error: `At most ${REFILL_MAX_IDS} Google Place IDs per press, got ${googlePlaceIds.length}` };
  }
  if (body.action === "end_mesita_days") return { action: "end_mesita_days", googlePlaceIds };

  const tier = Number(body.tier);
  if (tier !== 1 && tier !== 2) {
    return { code: "tier_invalid", error: `tier must be 1 (2X) or 2 (5X), got ${quote(body.tier)}` };
  }
  const days = Number(body.days);
  if (!Number.isInteger(days) || days < 1 || days > REFILL_MAX_DAYS) {
    return { code: "days_invalid", error: `days must be 1 to ${REFILL_MAX_DAYS}, got ${quote(body.days)}` };
  }
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (requestId.length < 8 || requestId.length > 100) {
    return { code: "request_id_invalid", error: "requestId must be 8 to 100 characters" };
  }
  return { action: "refill", googlePlaceIds, tier, days, requestId };
}

/** One RPC reply → one line. Anything but ok / refused is unknown: the
 *  press did not get an answer for that place, and Retry unfinished resends
 *  it with the same requestId. */
export function lineFor(googlePlaceId: string, placeId: string, reply: unknown): RefillLine {
  const r = (reply ?? {}) as Record<string, unknown>;
  if (r.result === "refused" && typeof r.code === "string") {
    return { googlePlaceId, placeId, result: "refused", code: r.code };
  }
  if (r.result !== "ok") return { googlePlaceId, placeId, result: "unknown" };
  const line: RefillLine = {
    googlePlaceId,
    placeId,
    result: "ok",
    ends_at_2x: (r.ends_at_2x as string | null) ?? null,
    ends_at_5x: (r.ends_at_5x as string | null) ?? null,
  };
  if (typeof r.replayed === "boolean") line.replayed = r.replayed;
  if (typeof r.ended_days === "number") line.ended_days = r.ended_days;
  return line;
}

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

/** Runs every line: one lookup for the IDs, then one RPC per place found,
 *  REFILL_CONCURRENCY at a time. An ID not on Mesita is refused not_found;
 *  an RPC that errors is unknown (logged). Each line is logged once. */
export async function runRefill(
  req: RefillRequest,
  deps: {
    resolve: (googlePlaceIds: string[]) => Promise<Map<string, string>>;
    rpc: Rpc;
    by: string;
    requestId: string;
    log?: (entry: Record<string, unknown>) => void;
  },
): Promise<RefillLine[]> {
  const found = await deps.resolve(req.googlePlaceIds);
  const lines: RefillLine[] = new Array(req.googlePlaceIds.length);
  let next = 0;

  async function one(i: number): Promise<void> {
    const googlePlaceId = req.googlePlaceIds[i];
    const placeId = found.get(googlePlaceId) ?? null;
    let line: RefillLine;
    if (!placeId) {
      line = { googlePlaceId, placeId: null, result: "refused", code: "not_found" };
    } else {
      const { data, error } = req.action === "refill"
        ? await deps.rpc("premier_add_days", {
          p_place_id: placeId,
          p_tier: req.tier,
          p_days: req.days,
          p_source: "admin",
          p_by: deps.by,
          p_request_id: req.requestId,
        })
        : await deps.rpc("premier_end_mesita_days", { p_place_id: placeId, p_by: deps.by });
      if (error) {
        console.error(`[premier-refill] ${req.action}`, deps.requestId, placeId, error.message);
        line = { googlePlaceId, placeId, result: "unknown" };
      } else {
        line = lineFor(googlePlaceId, placeId, data);
      }
    }
    lines[i] = line;
    (deps.log ?? ((e) => console.log(JSON.stringify(e))))({
      request_id: deps.requestId,
      action: req.action,
      place: placeId,
      google_place_id: googlePlaceId,
      tier: req.action === "refill" ? req.tier : null,
      days: req.action === "refill" ? req.days : null,
      result: line.result,
      code: line.code ?? null,
    });
  }

  async function worker(): Promise<void> {
    while (next < req.googlePlaceIds.length) await one(next++);
  }
  await Promise.all(Array.from({ length: Math.min(REFILL_CONCURRENCY, req.googlePlaceIds.length) }, worker));
  return lines;
}

/** Google Place ID → Mesita place id, in one read: chunks of ID_CHUNK at
 *  once (any state: the RPC answers archived / unlisted itself). */
export async function resolveGooglePlaceIds(
  admin: SupabaseClient,
  googlePlaceIds: string[],
): Promise<Map<string, string>> {
  const pages = await Promise.all(
    chunked(googlePlaceIds, ID_CHUNK).map((ids) =>
      admin.from("profiles").select("id, google_place_id").in("google_place_id", ids).limit(ids.length)
    ),
  );
  const found = new Map<string, string>();
  for (const { data, error } of pages) {
    if (error) throw new Error(`place lookup failed: ${error.message}`);
    for (const row of (data ?? []) as { id: string; google_place_id: string | null }[]) {
      if (row.google_place_id) found.set(row.google_place_id, row.id);
    }
  }
  return found;
}
