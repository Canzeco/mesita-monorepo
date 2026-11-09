// The agent Enrich (MESITA-3242): a real Enrich run on a short list of
// places named by Google place id, startable without an admin press, so an
// agent can re-enrich the places a fix was made for.
//
// Guards, in order: at most AGENT_ENRICH_MAX ids; Firecrawl must hold at
// least FIRECRAWL_FLOOR credits (Links spends about 15 a place, and an empty
// plan still spends Apify and OpenAI for nothing, MESITA-3242); each id must
// be in the catalog (never created here); a place changed in the last hour
// is skipped (the smoke cooldown, so a caller in a loop starts each place at
// most once an hour); then startEnrichment claims each place, so one already
// enriching is skipped and Render is not called twice.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { startEnrichment } from "./enrich-start.ts";
import { smokeCooldownRefusal } from "./smoke-enrich.ts";

/** The most places one agent start may carry. */
export const AGENT_ENRICH_MAX = 10;

/** Firecrawl credits that must remain before a run starts. */
export const FIRECRAWL_FLOOR = 100;

type Env = { get(name: string): string | undefined };

export type AgentEnrichStart =
  | {
    ok: true;
    task: string;
    started: string[];
    skipped: { googlePlaceId: string; reason: string }[];
    firecrawlCredits: number;
  }
  | { ok: false; status: number; error: string; firecrawlCredits?: number | null };

/** The ids to start, trimmed and unique, or why the list is refused. */
export function agentEnrichIds(raw: unknown): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "googlePlaceIds must be a list." };
  const ids = [...new Set(raw.map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (ids.length === 0) return { ok: false, error: "googlePlaceIds is empty." };
  if (ids.length > AGENT_ENRICH_MAX) {
    return { ok: false, error: `At most ${AGENT_ENRICH_MAX} places per agent enrich.` };
  }
  return { ok: true, ids };
}

/** Null when Firecrawl's balance may pay for a run, else why not. */
export function firecrawlRefusal(remaining: number | null): string | null {
  if (remaining === null) return "Firecrawl's balance could not be read; no run started.";
  if (remaining < FIRECRAWL_FLOOR) {
    return `Firecrawl has ${remaining} credits, under the floor of ${FIRECRAWL_FLOOR}; no run started.`;
  }
  return null;
}

/** Firecrawl's remaining credits, or null when the answer has none. */
export async function firecrawlCredits(env: Env, fetchImpl: typeof fetch = fetch): Promise<number | null> {
  const key = (env.get("FIRECRAWL_KEY") ?? "").trim();
  if (!key) return null;
  try {
    const res = await fetchImpl("https://api.firecrawl.dev/v2/team/credit-usage", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const body = await res.json() as { data?: Record<string, unknown> };
    const n = body?.data?.remainingCredits ?? body?.data?.remaining_credits;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function startAgentEnrich(
  admin: SupabaseClient,
  rawIds: unknown,
  opts: { now?: number; env?: Env; fetchImpl?: typeof fetch } = {},
): Promise<AgentEnrichStart> {
  const parsed = agentEnrichIds(rawIds);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const env = opts.env ?? Deno.env;

  const credits = await firecrawlCredits(env, opts.fetchImpl);
  const broke = firecrawlRefusal(credits);
  if (broke) return { ok: false, status: 402, error: broke, firecrawlCredits: credits };

  const { data: profiles, error } = await admin
    .from("place_profiles")
    .select("id, google_place_id")
    .in("google_place_id", parsed.ids);
  if (error) return { ok: false, status: 500, error: `catalog: ${error.message}` };
  const placeByGoogle = new Map<string, string>();
  for (const row of (profiles ?? []) as { id: string; google_place_id: string }[]) {
    placeByGoogle.set(row.google_place_id, row.id);
  }

  const skipped: { googlePlaceId: string; reason: string }[] = [];
  const found = parsed.ids.filter((gid) => {
    if (placeByGoogle.has(gid)) return true;
    skipped.push({ googlePlaceId: gid, reason: "not in the catalog" });
    return false;
  });

  const { data: places, error: placeErr } = found.length
    ? await admin.from("places").select("id, updated_at").in("id", found.map((gid) => placeByGoogle.get(gid)!))
    : { data: [], error: null };
  if (placeErr) return { ok: false, status: 500, error: `places: ${placeErr.message}` };
  const updatedAt = new Map<string, string | null>();
  for (const row of (places ?? []) as { id: string; updated_at: string | null }[]) {
    updatedAt.set(row.id, row.updated_at);
  }

  const now = opts.now ?? Date.now();
  const ready: string[] = [];
  const googleByPlace = new Map<string, string>();
  for (const gid of found) {
    const placeId = placeByGoogle.get(gid)!;
    const cooling = smokeCooldownRefusal(updatedAt.get(placeId), now);
    if (cooling) {
      skipped.push({ googlePlaceId: gid, reason: cooling });
      continue;
    }
    ready.push(placeId);
    googleByPlace.set(placeId, gid);
  }
  if (ready.length === 0) {
    return { ok: false, status: 409, error: "No place left to start.", firecrawlCredits: credits };
  }

  const started = await startEnrichment(admin, { placeIds: ready, env: opts.env, fetchImpl: opts.fetchImpl });
  if (!started.ok) return { ok: false, status: started.status, error: started.error, firecrawlCredits: credits };
  for (const placeId of started.skipped) {
    skipped.push({ googlePlaceId: googleByPlace.get(placeId) ?? placeId, reason: "already enriching" });
  }
  return { ok: true, task: started.task, started: started.started, skipped, firecrawlCredits: credits! };
}
