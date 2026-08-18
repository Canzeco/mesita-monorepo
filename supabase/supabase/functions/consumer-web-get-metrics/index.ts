// Supabase Edge Function — consumer-web-get-metrics
//
// Authenticated. The Me → Metrics sheet (MESITA-895 / MESITA-904): lifetime
// counters of everything the signed-in guest has done. Deliberately NOT part
// of consumer-web-get-profile — that EF runs on every shell load, this one
// only when the sheet opens.
//
// Counters (10 tiles, funnel → value):
//   places_viewed       place-detail opens — not tracked yet → always 0
//   places_saved        saved_places rows
//   places_visited      = rewards_claimed (revealed tickets). A visit is a
//                       reward claim; the two tiles MUST never diverge.
//   rewards_claimed     tickets the v3 close sealed ("revealed")
//   reservations_booked confirmed, non-test reservations (all time)
//   mesita_reviews      ticket_reviews rows
//   google_reviews      tickets with a verified Google review
//   instagram_stories   tickets with a verified Instagram story
//   spent_cents         sum of guest-paid cents on revealed tickets
//                       (pre-discount bill − discount; 0 when no bill)
//   saved_cents         sum of discount_cents on revealed tickets
//
// Self-contained: verifies the JWT, reads through the service role. Every
// read is best-effort — a failed count degrades to 0, never a 500.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { isActionVerified } from "../_shared/rewards-config.ts";
import { CLOSED_TICKET_STATUS } from "../_shared/ticket-status.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const _methodGuard = rejectUnlessMethods(req, "GET", "POST");
  if (_methodGuard) return _methodGuard;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const admin = adminClient(envRes.env);

  const [ticketsRes, reservationsRes, savesRes, mesitaReviewsRes] =
    await Promise.all([
      admin
        .from("visit_tickets")
        .select(
          "status, story_status, review_status, bill_subtotal_cents, total_cents, discount_cents",
        )
        .eq("consumer_id", userId),
      admin
        .from("reservation_tickets")
        .select("id", { count: "exact", head: true })
        .eq("consumer_id", userId)
        .eq("is_test", false)
        .eq("status", "confirmed"),
      admin
        .from("favorites")
        .select("id", { count: "exact", head: true })
        .eq("consumer_id", userId),
      admin
        .from("ticket_reviews")
        .select("ticket_id", { count: "exact", head: true })
        .eq("consumer_id", userId),
    ]);

  const tickets = ticketsRes.data ?? [];
  const revealed = tickets.filter((t) => t.status === CLOSED_TICKET_STATUS);
  // Product lock (MESITA-904): a place visit IS a reward claim — same source.
  const rewardsClaimed = revealed.length;
  const googleReviews = tickets.filter((t) =>
    isActionVerified(t.review_status)
  ).length;
  const instagramStories = tickets.filter((t) =>
    isActionVerified(t.story_status)
  ).length;

  let spentCents = 0;
  let savedCents = 0;
  for (const t of revealed) {
    const bill = t.total_cents ?? t.bill_subtotal_cents ?? 0;
    const discount = t.discount_cents ?? 0;
    savedCents += discount;
    // Guest-paid = pre-discount bill minus discount (never negative).
    if (bill > 0) spentCents += Math.max(0, bill - discount);
  }

  return json({
    ok: true,
    metrics: {
      // No place-detail view ledger yet — honest zero until tracked.
      places_viewed: 0,
      places_saved: savesRes.count ?? 0,
      places_visited: rewardsClaimed,
      rewards_claimed: rewardsClaimed,
      reservations_booked: reservationsRes.count ?? 0,
      mesita_reviews: mesitaReviewsRes.count ?? 0,
      google_reviews: googleReviews,
      instagram_stories: instagramStories,
      spent_cents: spentCents,
      saved_cents: savedCents,
    },
  });
});
