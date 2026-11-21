// Foursquare Places (MESITA-4515).
//
// Creation and a deep update of a place with no link search by name and
// location (several queries, MESITA-4552), then keep a match when the name,
// the coordinates and the street number agree; when that rule keeps none, a
// model may pick one plausible candidate or none. Step 2 reads the matched
// place's details (popularity included) and stores them. A later deep update of a linked place reads
// popularity for that id and does not search. A failed read leaves the
// stored score alone. Fast Update, Discovery and the Profile page never
// call this.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { haversineKm } from "./geo.ts";
import { writePlace } from "./place-doc.ts";
import { openaiChat } from "./enrich-config.ts";
import { loadModelsConfig } from "./models-config.ts";

const API = "https://places-api.foursquare.com";
const VERSION = "2025-06-17";
const MATCH_KM = 0.15;
/** MESITA-4552: wider, so a branch whose Foursquare pin sits a block away
 *  is still a candidate; the picker decides. */
const SEARCH_RADIUS_M = 600;
const SEARCH_LIMIT = 10;
/** A candidate the model may pick must be this close. */
const MODEL_MAX_KM = 0.6;
/** Step 2 (MESITA-4552): one details call with the Pro fields and the
 *  Premium fields that ride the same price as popularity. Tips and photos
 *  are separate Premium calls and are not read. */
const DETAIL_FIELDS = [
  "fsq_place_id", "name", "categories", "location", "tel", "website", "social_media", "link", "chains",
  "date_closed", "description", "rating", "price", "hours", "hours_popular", "stats", "tastes",
  "attributes", "popularity", "menu",
].join(",");

/** The Places API service key. The cloud secret is `FOURSQUARE_KEY`
 *  (MESITA-4544: reading only the other two names skipped every lookup). */
export function foursquareServiceKey(): string | null {
  const key = Deno.env.get("FOURSQUARE_KEY")?.trim()
    || Deno.env.get("FOURSQUARE_SERVICE_KEY")?.trim()
    || Deno.env.get("FSQ_SERVICE_KEY")?.trim()
    || "";
  return key || null;
}

export function foursquareVenueUrl(id: string): string {
  return `https://foursquare.com/v/${id}`;
}

/** The id at the end of a Foursquare venue URL, when one is stored. */
export function foursquareIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/foursquare\.com\/v\/(?:[^/?#]+\/)?([A-Za-z0-9]+)\/?(?:[?#]|$)/);
  return match?.[1] ?? null;
}

export type FoursquareCandidate = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
};

const NAME_STOP = new Set(["the", "a", "an", "de", "del", "la", "el", "los", "las", "y", "and"]);

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0 && !NAME_STOP.has(token));
}

function namesAgree(left: string, right: string): boolean {
  const a = nameTokens(left);
  const b = nameTokens(right);
  if (a.length === 0 || b.length === 0) return false;
  const setA = new Set(a);
  const setB = new Set(b);
  const shared = a.filter((token) => setB.has(token)).length;
  const smaller = Math.min(setA.size, setB.size);
  if (smaller > 0 && shared === smaller) return true;
  const union = new Set([...a, ...b]).size;
  return union > 0 && shared / union >= 0.6;
}

/** The first street number in an address. A 5-digit number is a postal
 *  code, never a street number (MESITA-4557: "64700 Monterrey" read as
 *  64700 ≠ 221 rejected Taquería Orinoco TEC). */
export function streetNumber(address: string | null): string | null {
  for (const m of address?.matchAll(/\b(\d+[a-zA-Z]?)\b/g) ?? []) {
    if (/^\d{5,}$/.test(m[1])) continue;
    return m[1].toLowerCase();
  }
  return null;
}

/**
 * The one candidate that is the same branch. Two plausible branches close
 * together stay unmatched: a chain on the same block is the failure mode.
 */
export function pickFoursquareMatch(
  place: { name: string; lat: number; lng: number; address: string | null },
  candidates: readonly FoursquareCandidate[],
): FoursquareCandidate | null {
  const placeNumber = streetNumber(place.address);
  const passing = candidates
    .map((candidate) => {
      if (candidate.lat === null || candidate.lng === null) return null;
      if (!namesAgree(place.name, candidate.name)) return null;
      const km = haversineKm(place.lat, place.lng, candidate.lat, candidate.lng);
      if (!Number.isFinite(km) || km > MATCH_KM) return null;
      const candidateNumber = streetNumber(candidate.address);
      if (placeNumber && candidateNumber && placeNumber !== candidateNumber) return null;
      return { candidate, km };
    })
    .filter((row): row is { candidate: FoursquareCandidate; km: number } => row !== null)
    .sort((a, b) => a.km - b.km);
  if (passing.length === 0) return null;
  if (passing.length > 1 && passing[1].km < 0.08 && passing[0].km > passing[1].km * 0.5) return null;
  return passing[0].candidate;
}

type HttpGet = (url: string, init: RequestInit) => Promise<Response>;

/** Why each candidate was kept or not (MESITA-4552's debug answer). */
export type FoursquareTrace = {
  queries: string[];
  candidates: Array<{ id: string; name: string; address: string | null; km: number | null; verdict: string }>;
  picked: { id: string; by: "rule" | "model" } | null;
  model?: { asked: number; answer: string | null; error?: string };
  detailsRead?: { ok: boolean; error?: string };
};

/** The search queries (MESITA-4552): the name; the name without its
 *  parenthesised branch ("Taquería Orinoco (TEC)" → "Taquería Orinoco");
 *  and its distinctive words alone ("Orinoco"). */
export function foursquareQueries(name: string): string[] {
  const full = name.trim();
  const bare = full.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const GENERIC = new Set([
    ...NAME_STOP, "taqueria", "tacos", "restaurante", "restaurant", "bar", "cafe", "coffee", "cocina",
    "grill", "kitchen", "food", "comida", "cantina", "pizzeria",
  ]);
  const core = nameTokens(bare).filter((t) => !GENERIC.has(t)).join(" ");
  return [...new Set([full, bare, core].filter((q) => q.length >= 2))];
}

/** Each candidate's verdict under the strict rule (the same rule as
 *  `pickFoursquareMatch`), for the trace and the model's shortlist. */
function verdictOf(
  place: { name: string; lat: number; lng: number; address: string | null },
  c: FoursquareCandidate,
): { km: number | null; verdict: string } {
  if (c.lat === null || c.lng === null) return { km: null, verdict: "no coordinates" };
  const km = haversineKm(place.lat, place.lng, c.lat, c.lng);
  if (!namesAgree(place.name, c.name)) return { km, verdict: "name differs" };
  if (!Number.isFinite(km) || km > MATCH_KM) return { km, verdict: `too far for the rule (${Math.round(km * 1000)} m)` };
  const a = streetNumber(place.address);
  const b = streetNumber(c.address);
  if (a && b && a !== b) return { km, verdict: `street number ${b} ≠ ${a}` };
  return { km, verdict: "passes the rule" };
}

/** The model's pick among plausible candidates (MESITA-4552): the strict
 *  rule kept none, but a candidate shares a distinctive word and sits
 *  within MODEL_MAX_KM. Answers an id from the list or null. */
export type FoursquareModelPick = (
  place: { name: string; address: string | null },
  candidates: Array<{ id: string; name: string; address: string | null; km: number }>,
) => Promise<{ id: string | null; error?: string }>;

export function openaiFoursquarePick(key: string, model: string): FoursquareModelPick {
  return async (place, candidates) => {
    const res = await openaiChat({
      key,
      model,
      json: true,
      temperature: 0,
      maxTokens: 200,
      messages: [
        {
          role: "system",
          content:
            "You match a restaurant to its Foursquare listing. Pick the candidate that is the SAME branch of the same business (a chain's other branch is not a match). Answer JSON {\"id\": \"<candidate id>\"} or {\"id\": null} when none is clearly the same place.",
        },
        {
          role: "user",
          content: JSON.stringify({
            place,
            candidates: candidates.map((c) => ({ ...c, metres: Math.round(c.km * 1000) })),
          }),
        },
      ],
    });
    if (!res.ok) return { id: null, error: `model ${res.status ?? "error"}` };
    const id = (res.parsed as { id?: unknown } | null)?.id;
    return { id: typeof id === "string" && candidates.some((c) => c.id === id) ? id : null };
  };
}

export type FoursquareRow = {
  name: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  foursquare_place_id: string | null;
  foursquare_url: string | null;
  foursquare_popularity: number | null;
};

export type FoursquarePlan =
  | { action: "unmatched" }
  | { action: "preserve"; error: string }
  | { action: "write"; patch: Record<string, unknown> };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function candidateFrom(value: unknown): FoursquareCandidate | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = typeof row.fsq_place_id === "string" ? row.fsq_place_id
    : typeof row.fsq_id === "string" ? row.fsq_id
    : null;
  const name = typeof row.name === "string" ? row.name : "";
  if (!id || !name) return null;
  const location = asRecord(row.location);
  const lat = typeof row.latitude === "number" ? row.latitude
    : typeof location?.latitude === "number" ? location.latitude
    : null;
  const lng = typeof row.longitude === "number" ? row.longitude
    : typeof location?.longitude === "number" ? location.longitude
    : null;
  const address = typeof location?.formatted_address === "string" ? location.formatted_address
    : typeof location?.address === "string" ? location.address
    : typeof row.address === "string" ? row.address
    : null;
  return { id, name, lat, lng, address };
}

function popularityOf(body: unknown): number | null {
  const row = asRecord(body);
  const raw = row?.popularity;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > 1) return null;
  return raw;
}

async function fsqGet(http: HttpGet, key: string, path: string): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
  try {
    const res = await http(`${API}${path}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Places-Api-Version": VERSION,
        Accept: "application/json",
      },
    });
    if (!res.ok) return { ok: false, error: `foursquare ${res.status}` };
    return { ok: true, body: await res.json() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "foursquare request failed" };
  }
}

function identityPatch(id: string, popularity: number | null, details?: unknown): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    foursquare_place_id: id,
    foursquare_url: foursquareVenueUrl(id),
  };
  if (details && typeof details === "object") {
    patch.foursquare_details = details;
    patch.foursquare_details_at = new Date().toISOString();
  }
  if (popularity !== null) {
    patch.foursquare_popularity = popularity;
    patch.foursquare_popularity_at = new Date().toISOString();
  }
  return patch;
}

/**
 * The patch a create or a deep update should write. `preserve` means a
 * linked place's refresh failed: the caller writes nothing, so the previous
 * score stays. `unmatched` writes nothing either.
 */
export async function planFoursquare(
  row: FoursquareRow,
  http: HttpGet,
  key: string,
  /** The model's pick when the rule keeps none (MESITA-4552); absent = rule only. */
  pick?: FoursquareModelPick,
  /** Filled with what each step saw, for the debug answer. */
  trace?: FoursquareTrace,
): Promise<FoursquarePlan> {
  const storedId = row.foursquare_place_id?.trim() || foursquareIdFromUrl(row.foursquare_url);
  if (storedId) {
    // A linked place skips step 1: step 2 refreshes popularity and details.
    const details = await fsqGet(http, key, `/places/${encodeURIComponent(storedId)}?fields=${DETAIL_FIELDS}`);
    if (trace) {
      trace.picked = { id: storedId, by: "rule" };
      trace.detailsRead = details.ok ? { ok: true } : { ok: false, error: details.error };
    }
    if (!details.ok) return { action: "preserve", error: details.error };
    const popularity = popularityOf(details.body);
    if (popularity === null) return { action: "preserve", error: "popularity absent" };
    return { action: "write", patch: identityPatch(storedId, popularity, details.body) };
  }
  const name = row.name?.trim() ?? "";
  if (!name || typeof row.lat !== "number" || typeof row.lng !== "number") return { action: "unmatched" };
  const place = { name, lat: row.lat, lng: row.lng, address: row.address };
  // Step 1, find: every query's candidates, one list by id.
  const queries = foursquareQueries(name);
  if (trace) trace.queries = queries;
  const byId = new Map<string, FoursquareCandidate>();
  let searchError: string | null = null;
  for (const query of queries) {
    const params = new URLSearchParams({
      query,
      ll: `${row.lat},${row.lng}`,
      radius: String(SEARCH_RADIUS_M),
      limit: String(SEARCH_LIMIT),
      fields: "fsq_place_id,name,latitude,longitude,location",
    });
    const search = await fsqGet(http, key, `/places/search?${params}`);
    if (!search.ok) {
      searchError = search.error;
      continue;
    }
    const body = asRecord(search.body);
    const list = Array.isArray(body?.results) ? body.results
      : Array.isArray(body?.places) ? body.places
      : Array.isArray(search.body) ? search.body
      : [];
    for (const c of list.map(candidateFrom)) if (c && !byId.has(c.id)) byId.set(c.id, c);
  }
  if (byId.size === 0 && searchError) return { action: "preserve", error: searchError };
  const candidates = [...byId.values()];
  const judged = candidates.map((c) => ({ c, ...verdictOf(place, c) }));
  if (trace) {
    trace.candidates = judged.map(({ c, km, verdict }) => ({
      id: c.id,
      name: c.name,
      address: c.address,
      km: km === null ? null : Math.round(km * 1000) / 1000,
      verdict,
    }));
  }
  let match = pickFoursquareMatch(place, candidates);
  let by: "rule" | "model" = "rule";
  if (!match && pick) {
    // The rule kept none: let the model choose among the plausible ones.
    const core = new Set(nameTokens(foursquareQueries(name).at(-1) ?? name));
    const shortlist = judged
      .filter(({ c, km }) => km !== null && km <= MODEL_MAX_KM && nameTokens(c.name).some((t) => core.has(t)))
      .map(({ c, km }) => ({ id: c.id, name: c.name, address: c.address, km: km as number }));
    if (shortlist.length > 0) {
      const answer = await pick({ name, address: row.address }, shortlist);
      if (trace) trace.model = { asked: shortlist.length, answer: answer.id, ...(answer.error ? { error: answer.error } : {}) };
      const chosen = answer.id ? byId.get(answer.id) ?? null : null;
      if (chosen) {
        match = chosen;
        by = "model";
      }
    }
  }
  if (!match) return { action: "unmatched" };
  if (trace) trace.picked = { id: match.id, by };
  // Step 2, fetch.
  const details = await fsqGet(http, key, `/places/${encodeURIComponent(match.id)}?fields=${DETAIL_FIELDS}`);
  if (trace) trace.detailsRead = details.ok ? { ok: true } : { ok: false, error: details.error };
  if (!details.ok) return { action: "write", patch: identityPatch(match.id, null) };
  return { action: "write", patch: identityPatch(match.id, popularityOf(details.body), details.body) };
}

export type FoursquareSync =
  | { status: "skipped" }
  | { status: "unmatched" }
  | { status: "preserved"; error: string }
  | { status: "saved" };

/** One lookup. Does nothing when the secret is unset. Never throws. */
export async function syncFoursquare(
  admin: SupabaseClient,
  placeId: string,
  opts: { trace?: FoursquareTrace; dryRun?: boolean } = {},
): Promise<FoursquareSync> {
  const key = foursquareServiceKey();
  if (!key) return { status: "skipped" };
  try {
    const { data, error } = await admin
      .from("place_profiles")
      .select("name, lat, lng, address, foursquare_place_id, foursquare_url, foursquare_popularity")
      .eq("id", placeId)
      .maybeSingle();
    if (error || !data) return { status: "preserved", error: error?.message ?? "place missing" };
    const openaiKey = Deno.env.get("OPENAI_KEY")?.trim();
    const pick = openaiKey
      ? openaiFoursquarePick(openaiKey, (await loadModelsConfig(admin)).enricherModel)
      : undefined;
    const plan = await planFoursquare(data as FoursquareRow, fetch, key, pick, opts.trace);
    if (plan.action === "unmatched") return { status: "unmatched" };
    if (plan.action === "preserve") {
      console.error(`[foursquare] ${placeId}: ${plan.error}`);
      return { status: "preserved", error: plan.error };
    }
    if (opts.dryRun) return { status: "saved" };
    const written = await writePlace(admin, { table: "place_profiles", mode: "update", id: placeId, patch: plan.patch });
    if (!written.ok) {
      console.error(`[foursquare] ${placeId}: ${written.error}`);
      return { status: "preserved", error: written.error };
    }
    return { status: "saved" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "foursquare sync failed";
    console.error(`[foursquare] ${placeId}: ${message}`);
    return { status: "preserved", error: message };
  }
}

/** Run after the HTTP response when the runtime supports it. */
export function deferFoursquare(task: Promise<unknown>): void {
  const edge = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (edge) edge.waitUntil(task);
  else void task.catch((err) => console.error("[foursquare]", err));
}
