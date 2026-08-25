// Supabase Edge Function — admin-web-get-config-sample
//
// A random sample of REAL consumers and REAL places, with enough context for
// an admin config page to preview its draft against live data instead of
// fixtures. Shared surface: it feeds the Memo Config playground.
//
// Was `admin-web-get-scoring-sample` until MESITA-1048. The Lineup scoring
// engine it was first written for is deleted (subscores, lanes, the
// scoring_config blob and both /lineup-config pages went with it); the sampler
// itself is generic and survives under a name that doesn't lie.
//
// Consumer taste comes from what they actually saved/visited (favorites /
// paid tickets → place categories+tags). Empty history returns empty arrays —
// the client synthesizes taste and LABELS it synthetic; this EF never invents
// data. Read-only; nothing here writes.
//
// Auth: caller's JWT email must be in public.super_admins.
// verify_jwt = true gates non-bearer callers at the gateway.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, jsonError, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type Body = { consumers?: unknown; places?: unknown };

const MAX = 10;

function capCount(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isInteger(v)
    ? Math.min(Math.max(v, 1), MAX)
    : fallback;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const nConsumers = capCount(bodyRes.body.consumers, MAX);
  const nPlaces = capCount(bodyRes.body.places, MAX);

  // ── Places — base fields + rates (projects shares the id) ────────────
  const { data: placeRows, error: pErr } = await admin
    .from("places")
    .select(
      "id, name, category, tags, zone, city, description, lat, lng, timezone, hours, google_stars_overall, google_review_count",
    )
    .limit(200);
  if (pErr) return jsonError(`places_failed: ${pErr.message}`, 500);

  const places = shuffle(placeRows ?? []).slice(0, nPlaces);
  const placeIds = places.map((p) => p.id);

  const { data: rateRows, error: rErr } = await admin
    .from("projects")
    .select("id, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate")
    .in("id", placeIds);
  if (rErr) return jsonError(`rates_failed: ${rErr.message}`, 500);
  const rates = new Map((rateRows ?? []).map((r) => [r.id, r]));

  const placesOut = places.map((p) => ({
    ...p,
    description:
      typeof p.description === "string" ? p.description.slice(0, 400) : null,
    ...(rates.get(p.id) ?? {
      welcome_free_rate: null,
      welcome_premium_rate: null,
      free_rate: null,
      premium_rate: null,
    }),
  }));

  // ── Consumers — identity + taste from what they saved / visited ──────
  const { data: consumerRows, error: cErr } = await admin
    .from("consumers")
    .select(
      "id, first_name, full_name, class_key, instagram_followers_count, sex, birthday, country",
    )
    .limit(200);
  if (cErr) return jsonError(`consumers_failed: ${cErr.message}`, 500);

  const consumers = shuffle(consumerRows ?? []).slice(0, nConsumers);
  const consumerIds = consumers.map((c) => c.id);

  // Taste sources: saved places + paid-ticket visits → categories/tags.
  const savedBy = new Map<string, string[]>();
  const visitedBy = new Map<string, string[]>();
  if (consumerIds.length > 0) {
    const [{ data: saves, error: sErr }, { data: visits, error: vErr }] = await Promise.all([
      admin
        .from("favorites")
        .select("consumer_id, place_id")
        .in("consumer_id", consumerIds)
        .limit(300),
      admin
        .from("visit_tickets")
        .select("consumer_id, place_id")
        .in("consumer_id", consumerIds)
        .not("paid_at", "is", null)
        .limit(300),
    ]);
    if (sErr) return jsonError(`saves_failed: ${sErr.message}`, 500);
    if (vErr) return jsonError(`visits_failed: ${vErr.message}`, 500);

    const refIds = [
      ...new Set([...(saves ?? []), ...(visits ?? [])].map((r) => r.place_id)),
    ];
    const tasteMeta = new Map<string, { category: string | null; tags: string[] }>();
    if (refIds.length > 0) {
      const { data: refPlaces, error: fErr } = await admin
        .from("places")
        .select("id, category, tags")
        .in("id", refIds);
      if (fErr) return jsonError(`taste_failed: ${fErr.message}`, 500);
      for (const rp of refPlaces ?? []) {
        tasteMeta.set(rp.id, {
          category: rp.category ?? null,
          tags: Array.isArray(rp.tags) ? rp.tags : [],
        });
      }
    }
    const fold = (
      rows: { consumer_id: string; place_id: string }[] | null,
      into: Map<string, string[]>,
    ) => {
      for (const row of rows ?? []) {
        const meta = tasteMeta.get(row.place_id);
        if (!meta) continue;
        const list = into.get(row.consumer_id) ?? [];
        if (meta.category) list.push(meta.category);
        list.push(...meta.tags.slice(0, 6));
        into.set(row.consumer_id, list);
      }
    };
    fold(saves, savedBy);
    fold(visits, visitedBy);
  }

  const consumersOut = consumers.map((c) => {
    // Age, not birthday — the playground needs demographics, not a dossier.
    let age: number | null = null;
    if (typeof c.birthday === "string") {
      const b = new Date(c.birthday);
      if (!Number.isNaN(b.getTime())) {
        age = Math.floor((Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000));
        if (age < 0 || age > 120) age = null;
      }
    }
    return {
      id: c.id,
      // First name only.
      label: c.first_name ?? (c.full_name ? String(c.full_name).split(" ")[0] : null),
      class_key: c.class_key ?? "standard",
      instagram_followers: c.instagram_followers_count ?? null,
      sex: typeof c.sex === "string" ? c.sex : null,
      age,
      country: typeof c.country === "string" ? c.country : null,
      saved_taste: [...new Set(savedBy.get(c.id) ?? [])].slice(0, 20),
      visited_taste: [...new Set(visitedBy.get(c.id) ?? [])].slice(0, 20),
    };
  });

  return json({ ok: true, consumers: consumersOut, places: placesOut });
});
