// Foursquare Places (MESITA-4515).
//
// Creation and a deep update of a place with no venue link search by name
// and location, then keep a match only when the name, the coordinates and
// the street number agree. A later deep update of a linked place reads
// popularity for that id and does not search. A failed read leaves the
// stored score alone. Fast Update, Discovery and the Profile page never
// call this.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { haversineKm } from "./geo.ts";
import { writePlace } from "./place-doc.ts";

const API = "https://places-api.foursquare.com";
const VERSION = "2025-06-17";
const MATCH_KM = 0.15;
const SEARCH_RADIUS_M = 250;

export function foursquareServiceKey(): string | null {
  const key = Deno.env.get("FOURSQUARE_SERVICE_KEY")?.trim()
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

function streetNumber(address: string | null): string | null {
  const match = address?.match(/\b(\d+[a-zA-Z]?)\b/);
  return match?.[1]?.toLowerCase() ?? null;
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

function identityPatch(id: string, popularity: number | null): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    foursquare_place_id: id,
    foursquare_url: foursquareVenueUrl(id),
  };
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
): Promise<FoursquarePlan> {
  const storedId = row.foursquare_place_id?.trim() || foursquareIdFromUrl(row.foursquare_url);
  if (storedId) {
    const details = await fsqGet(http, key, `/places/${encodeURIComponent(storedId)}?fields=popularity`);
    if (!details.ok) return { action: "preserve", error: details.error };
    const popularity = popularityOf(details.body);
    if (popularity === null) return { action: "preserve", error: "popularity absent" };
    return { action: "write", patch: identityPatch(storedId, popularity) };
  }
  const name = row.name?.trim() ?? "";
  if (!name || typeof row.lat !== "number" || typeof row.lng !== "number") return { action: "unmatched" };
  const params = new URLSearchParams({
    query: name,
    ll: `${row.lat},${row.lng}`,
    radius: String(SEARCH_RADIUS_M),
    limit: "5",
    fields: "fsq_place_id,name,latitude,longitude,location",
  });
  const search = await fsqGet(http, key, `/places/search?${params}`);
  if (!search.ok) return { action: "preserve", error: search.error };
  const body = asRecord(search.body);
  const list = Array.isArray(body?.results) ? body.results
    : Array.isArray(body?.places) ? body.places
    : Array.isArray(search.body) ? search.body
    : [];
  const match = pickFoursquareMatch(
    { name, lat: row.lat, lng: row.lng, address: row.address },
    list.map(candidateFrom).filter((candidate): candidate is FoursquareCandidate => candidate !== null),
  );
  if (!match) return { action: "unmatched" };
  const details = await fsqGet(http, key, `/places/${encodeURIComponent(match.id)}?fields=popularity`);
  if (!details.ok) return { action: "write", patch: identityPatch(match.id, null) };
  return { action: "write", patch: identityPatch(match.id, popularityOf(details.body)) };
}

export type FoursquareSync =
  | { status: "skipped" }
  | { status: "unmatched" }
  | { status: "preserved"; error: string }
  | { status: "saved" };

/** One lookup. Does nothing when the secret is unset. Never throws. */
export async function syncFoursquare(admin: SupabaseClient, placeId: string): Promise<FoursquareSync> {
  const key = foursquareServiceKey();
  if (!key) return { status: "skipped" };
  try {
    const { data, error } = await admin
      .from("place_profiles")
      .select("name, lat, lng, address, foursquare_place_id, foursquare_url, foursquare_popularity")
      .eq("id", placeId)
      .maybeSingle();
    if (error || !data) return { status: "preserved", error: error?.message ?? "place missing" };
    const plan = await planFoursquare(data as FoursquareRow, fetch, key);
    if (plan.action === "unmatched") return { status: "unmatched" };
    if (plan.action === "preserve") {
      console.error(`[foursquare] ${placeId}: ${plan.error}`);
      return { status: "preserved", error: plan.error };
    }
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
