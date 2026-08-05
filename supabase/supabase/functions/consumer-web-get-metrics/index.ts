// Supabase Edge Function — consumer-web-get-metrics
//
// Authenticated. The Me → Metrics sheet (MESITA-895): lifetime counters of
// everything the signed-in guest has done. Deliberately NOT part of
// consumer-web-get-profile — that EF runs on every shell load, this one only
// when the sheet opens.
//
// Counters:
//   visits        tickets the v3 close sealed ("revealed")
//   places        distinct projects among those revealed tickets
//   reservations  confirmed, non-test reservations (all time; "passed" is
//                 derived from confirmed, so this covers past tables too)
//   saves         saved places
//   stories       tickets with a verified story
//   reviews       verified Google reviews + Mesita post-visit reviews
//
// Self-contained: verifies the JWT, reads through the service role. Every
// read is best-effort — a failed count degrades to 0, never a 500.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { isActionVerified } from "../_shared/rewards-config.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const admin = adminClient(envRes.env);

  // One tickets read covers four counters (visits, places, stories, the
  // Google-review half of reviews); the rest are head counts.
  const [ticketsRes, reservationsRes, savesRes, mesitaReviewsRes] =
    await Promise.all([
      admin
        .from("tickets")
        .select("project_id, status, story_status, review_status")
        .eq("consumer_id", userId),
      admin
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("consumer_id", userId)
        .eq("is_test", false)
        .eq("status", "confirmed"),
      admin
        .from("saved_places")
        .select("id", { count: "exact", head: true })
        .eq("consumer_id", userId),
      admin
        .from("ticket_reviews")
        .select("ticket_id", { count: "exact", head: true })
        .eq("consumer_id", userId),
    ]);

  const tickets = ticketsRes.data ?? [];
  const revealed = tickets.filter((t) => t.status === "revealed");
  const places = new Set(
    revealed.map((t) => t.project_id).filter(Boolean),
  ).size;
  const stories = tickets.filter((t) =>
    isActionVerified(t.story_status)
  ).length;
  const googleReviews = tickets.filter((t) =>
    isActionVerified(t.review_status)
  ).length;

  return json({
    ok: true,
    metrics: {
      visits: revealed.length,
      places,
      reservations: reservationsRes.count ?? 0,
      saves: savesRes.count ?? 0,
      stories,
      reviews: googleReviews + (mesitaReviewsRes.count ?? 0),
    },
  });
});
