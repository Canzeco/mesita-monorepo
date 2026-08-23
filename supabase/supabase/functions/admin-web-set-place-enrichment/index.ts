// Supabase Edge Function — admin-web-set-place-enrichment (product caller / admin)
//
// WHEN a place re-enriches, as opposed to admin-web-enrich-place's "now"
// (MESITA-1148). Writes the three schedule columns on public.places and
// derives the next due date; the pg_cron enqueuer
// (queue_due_place_enrichments, every 15 min) is what honours them, and
// run_place_enrichment_stages remains the only dispatcher.
//
//   everyDays  null = manual only (the default: nothing runs unless a human
//              presses Re-enrich). 1–365 = the cadence.
//   mode       which slice a SCHEDULED run re-runs — same vocabulary as
//              admin-web-enrich-place: full | analysis | contents. A lighter
//              mode whose stored payload is missing falls back to full at
//              enqueue time rather than queueing a stage that would fail.
//
// The next due date is measured from the LAST completed enrichment, not from
// now: "every 30 days" on a place enriched 40 days ago means it is due now,
// not in a month. A place that has never enriched is due immediately.
//
// Internal enricher control — super-admin gated, admin console only.
//
// Local:  supabase functions serve admin-web-set-place-enrichment
// Deploy: supabase functions deploy admin-web-set-place-enrichment

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { writePlace } from "../_shared/place-doc.ts";

type EnrichMode = "full" | "analysis" | "contents";
type Body = {
  projectId?: string;
  placeId?: string;
  everyDays?: number | null;
  mode?: string;
};

const MODES: EnrichMode[] = ["full", "analysis", "contents"];
const DAY_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const guard = await requireSuperAdmin(
    admin,
    authRes.user,
    "Only admins can schedule enrichment.",
  );
  if (!guard.ok) return guard.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const projectId = readPlaceIdAlias(bodyRes.body);
  if (!projectId) return json({ ok: false, error: "Missing projectId" }, 400);

  // ── everyDays: null/0 both mean manual. Anything else must be a whole
  //    number of days inside the column's own 1–365 check. ──
  const rawDays = bodyRes.body.everyDays;
  let everyDays: number | null = null;
  if (rawDays !== null && rawDays !== undefined && rawDays !== 0) {
    const n = Math.round(Number(rawDays));
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      return json(
        { ok: false, error: "everyDays must be null (manual) or 1–365." },
        400,
      );
    }
    everyDays = n;
  }

  const mode = (bodyRes.body.mode ?? "full").toString().trim() as EnrichMode;
  if (!MODES.includes(mode)) {
    return json(
      { ok: false, error: `Invalid mode '${mode}'. Expected one of: ${MODES.join(", ")}.` },
      400,
    );
  }

  // The place must exist, and a scheduled run needs the identity spine the
  // research stage re-checks first — the same 422 admin-web-enrich-place
  // answers, refused here rather than queued and failed later.
  const { data: place, error: placeErr } = await admin
    .from("places")
    .select("id, google_place_id, enriched_at")
    .eq("id", projectId)
    .maybeSingle();
  if (placeErr) return json({ ok: false, error: `places: ${placeErr.message}` }, 500);
  if (!place) return json({ ok: false, error: "Place not found" }, 404);
  const row = place as {
    id: string;
    google_place_id: string | null;
    enriched_at: string | null;
  };
  if (everyDays !== null && !(row.google_place_id ?? "").trim()) {
    return json(
      { ok: false, error: "Place has no Google Place ID — nothing to enrich from." },
      422,
    );
  }

  // Due date from the last completed run, floored at now: a place enriched
  // long ago is due immediately, never overdue by a negative interval.
  let nextAt: string | null = null;
  if (everyDays !== null) {
    const last = row.enriched_at ? Date.parse(row.enriched_at) : NaN;
    const due = Number.isFinite(last) ? last + everyDays * DAY_MS : Date.now();
    nextAt = new Date(Math.max(due, Date.now())).toISOString();
  }

  const updRes = await writePlace(admin, {
    table: "places",
    mode: "update",
    id: projectId,
    patch: { enrich_every_days: everyDays, enrich_mode: mode, enrich_next_at: nextAt },
    select: "enrich_every_days, enrich_mode, enrich_next_at, enriched_at",
    selectMode: "maybeSingle",
  });
  if (!updRes.ok) return json({ ok: false, error: `update: ${updRes.error}` }, 500);
  const saved = updRes.row;
  if (!saved) return json({ ok: false, error: "Place not found" }, 404);

  const out = saved as {
    enrich_every_days: number | null;
    enrich_mode: string;
    enrich_next_at: string | null;
    enriched_at: string | null;
  };
  return json({
    ok: true,
    schedule: {
      everyDays: out.enrich_every_days,
      mode: out.enrich_mode,
      nextAt: out.enrich_next_at,
      lastEnrichedAt: out.enriched_at,
    },
  });
});
