// Supabase Edge Function — admin-web-search-reservation-targets
//
// Naming: caller-verb-words. Caller = admin, verb = search, words = reservation-targets.
//
// The Reservations Playground's pickers, kept deliberately dumb: no free-text
// search — each call returns a small RANDOM sample of real rows (default 10)
// for the operator to pick from. (v1 shipped a search bar over places.slug,
// which doesn't exist on `places` — slug lives on projects_view only. The
// playground doesn't need search; it needs ten pickable rows.)
//
// Returns the fields the playground needs to build a call brief — crucially the
// phone each side would use in "actual number" mode:
//   place    → the reservation endpoint the agent would dial
//              (products.reservations phone endpoint, else places.phone)
//   consumer → consumers.phone (the guest callback number)
//
// Auth: caller's JWT email must be in public.super_admins.
//
// Deploy: supabase functions deploy admin-web-search-reservation-targets

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type Body = { kind?: unknown; limit?: unknown };

// How many recent rows we sample from before shuffling. Small enough to stay a
// cheap indexed scan, big enough that consecutive loads feel different.
const POOL = 40;

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// The number the Reservationist would dial for this place in "actual" mode —
// mirrors supabase-edgefunc-reservation-call's non-test resolution exactly.
function placeDialNumber(row: {
  phone?: string | null;
  products?: Record<string, unknown> | null;
}): string | null {
  const resv = (row.products?.reservations ?? null) as
    | { channel?: string; value?: string }
    | null;
  return resv?.channel === "phone" && resv.value ? resv.value : row.phone ?? null;
}

function consumerName(row: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const full = row.full_name?.trim();
  if (full) return full;
  const joined = [row.first_name, row.last_name]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return joined || "(no name)";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const kind = bodyRes.body.kind;
  if (kind !== "place" && kind !== "consumer") {
    return json({ ok: false, error: "kind must be 'place' or 'consumer'" }, 400);
  }
  const limit =
    typeof bodyRes.body.limit === "number" && Number.isInteger(bodyRes.body.limit)
      ? Math.min(Math.max(bodyRes.body.limit, 1), 25)
      : 10;

  if (kind === "place") {
    const { data, error } = await admin
      .from("places")
      .select("id, name, address, phone, products, photos")
      .order("created_at", { ascending: false })
      .limit(POOL);
    if (error) return json({ ok: false, error: `targets_failed: ${error.message}` }, 500);
    const results = shuffle(data ?? []).slice(0, limit).map((v) => ({
      id: v.id,
      name: v.name ?? "(unnamed place)",
      address: v.address ?? null,
      photo: Array.isArray(v.photos) && v.photos.length > 0 ? v.photos[0] : null,
      // The line "actual number" mode would dial; null = place has no phone endpoint.
      phone: placeDialNumber(v),
    }));
    return json({ ok: true, kind, results });
  }

  // kind === "consumer"
  const { data, error } = await admin
    .from("consumers")
    .select("id, full_name, first_name, last_name, phone, avatar_url")
    .order("created_at", { ascending: false })
    .limit(POOL);
  if (error) return json({ ok: false, error: `targets_failed: ${error.message}` }, 500);
  const results = shuffle(data ?? []).slice(0, limit).map((v) => ({
    id: v.id,
    name: consumerName(v),
    phone: (v.phone as string | null)?.trim() || null,
    avatar: (v.avatar_url as string | null) ?? null,
  }));
  return json({ ok: true, kind, results });
});
