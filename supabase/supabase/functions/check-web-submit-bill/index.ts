// Supabase Edge Function — check-web-submit-bill (natural caller: the public
// check page)
//
// verify_jwt = FALSE — code-possession auth (see _shared/ticket-check.ts).
// The billing step of Tickets v2: staff (whoever holds the scanned QR) enter
// the check subtotal on mesita.ai/check/<code>. Pricing is IDENTICAL to the
// retired business-web-submit-ticket-bill path — same grid, same best-of
// resolveTicketRate, same computeTicketBill, same bill notification — minus
// requireMembership, keyed by the check code instead of a business JWT.
//
// Accepted risk, stated in the open: the guest holds their own URL and can
// self-bill. Mesita moves no money — the waiter applies the discount off the
// same page — so the exposure is data quality (visit history, and
// recordFirstTicketHonored at mark-paid trusting this surface), not theft.
// Every submit is audit-logged with self_view + ip_hash.
//
// Body:     { code: string, checkSubtotalCents: number }
// Response: { ok: true, check: {bill…} } | 404 | 409 | 429

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { computeTicketBill } from "../_shared/business-ticket-billing.ts";
import { isConsumerFirstVisit } from "../_shared/membership.ts";
import {
  isActionVerified,
  loadRewardsGrid,
  placeStrategy,
  resolveTicketRate,
} from "../_shared/rewards-config.ts";
import {
  assessPromoLane,
  loadMembershipRow,
} from "../_shared/membership-enforcement.ts";
import { placeInstagramHandleForPayload } from "../_shared/ticket-bill-payload.ts";
import { toCents } from "../_shared/money.ts";
import {
  checkNotFound,
  hashRequestIp,
  isRateLimited,
  loadTicketByCheckCode,
  logCheckEvent,
} from "../_shared/ticket-check.ts";

type Body = { code?: string; checkSubtotalCents?: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const admin = adminClient(envRes.env);

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const code = (bodyRes.body.code ?? "").toString().trim();
  if (!code) return checkNotFound(json);

  const subtotal = toCents(bodyRes.body.checkSubtotalCents);
  if (subtotal == null) {
    return json(
      { ok: false, error: "checkSubtotalCents must be a non-negative integer" },
      400,
    );
  }

  const ipHash = await hashRequestIp(req, envRes.env.serviceKey);
  if (await isRateLimited(admin, ipHash, { maxPerMinute: 30 })) {
    return json({ ok: false, error: "Too many requests" }, 429);
  }

  const ticket = await loadTicketByCheckCode(admin, code);
  if (!ticket) return checkNotFound(json);

  if (ticket.status !== "open") {
    return json(
      {
        ok: false,
        error: `Ticket is ${ticket.status} — billing only applies to open tickets.`,
      },
      409,
    );
  }
  if ((ticket.check_subtotal_cents ?? 0) > 0 || (ticket.total_cents ?? 0) > 0) {
    return json({ ok: false, error: "Bill already submitted for this ticket." }, 409);
  }

  const requiresStory = ticket.story_status != null &&
    ticket.story_status !== "not_required";

  const placeRow = await admin
    .from("projects_view")
    .select(
      "id, name, slug, photos, instagram_url, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, monthly_promo_cap, status",
    )
    .eq("id", ticket.project_id)
    .maybeSingle();
  if (placeRow.error || !placeRow.data) return checkNotFound(json);
  const place = placeRow.data;
  if (place.status === "archived") {
    return json({ ok: false, error: "Place is archived" }, 409);
  }

  const membershipRow = await loadMembershipRow(admin, ticket.project_id);
  if (membershipRow) {
    const lane = assessPromoLane(membershipRow);
    if (!lane.open) {
      return json({ ok: false, error: lane.staffMessage, code: lane.code }, 409);
    }
  }

  const consumerRow = await admin
    .from("consumers")
    .select("id, class_key")
    .eq("id", ticket.consumer_id)
    .maybeSingle();
  if (consumerRow.error || !consumerRow.data) return checkNotFound(json);

  // Best-of over the grid at the place's strategy — the ticket already
  // exists, so exclude it from the first-visit count (Welcome must fire on
  // the create → bill path exactly as it did on scan → bill).
  const grid = await loadRewardsGrid(admin);
  const firstVisit = await isConsumerFirstVisit(
    admin,
    ticket.consumer_id,
    ticket.project_id,
    ticket.id,
  );
  const ratePercent = resolveTicketRate(placeStrategy(place), grid, {
    classKey: consumerRow.data.class_key,
    isFirstVisit: firstVisit,
    storyVerified: isActionVerified(ticket.story_status),
    reviewVerified: isActionVerified(ticket.review_status),
  });
  const capPesos = grid.cap;

  const billRes = computeTicketBill({ subtotal, ratePercent, capPesos });
  if (!billRes.ok) {
    return json({ ok: false, code: billRes.code, error: billRes.error }, 400);
  }
  const snap = billRes.snapshot;

  const now = new Date().toISOString();
  const storyStatus = requiresStory ? "pending" : "not_required";
  const status = requiresStory ? "awaiting_story" : "awaiting_payment_confirm";

  const update = await admin
    .from("tickets")
    .update({
      status,
      story_status: storyStatus,
      check_subtotal_cents: snap.checkSubtotalCents,
      tip_cents: snap.tipCents,
      total_cents: snap.totalCents,
      redeem_cents: 0,
      discount_percent: snap.discountPercent,
      discount_cents: snap.discountCents,
    })
    .eq("id", ticket.id)
    .eq("status", "open") // concurrent double-submits lose cleanly
    .select("id, status, story_status, total_cents, discount_percent, discount_cents, check_subtotal_cents, currency")
    .single();
  if (update.error) {
    return json({ ok: false, error: `ticket_update: ${update.error.message}` }, 500);
  }

  // Deliver the discounted bill to the guest's Pay inbox (same payload shape
  // as the retired staff path — the consumer app already renders it).
  await admin.from("consumer_pay_notifications").insert({
    consumer_id: ticket.consumer_id,
    ticket_id: ticket.id,
    kind: "bill",
    status: "completed",
    resolved_at: now,
    payload: {
      project_id: place.id,
      place_slug: place.slug ?? null,
      place_name: place.name,
      place_photo_url: place.photos?.[0] ?? null,
      place_instagram_handle: placeInstagramHandleForPayload(place.instagram_url),
      ticket_kind: ticket.kind,
      check_subtotal_cents: snap.checkSubtotalCents,
      tip_cents: snap.tipCents,
      total_cents: snap.totalCents,
      discount_cents: snap.discountCents ?? 0,
      discount_percent: snap.discountPercent ?? 0,
      total_reward_cents: snap.discountCents ?? 0,
      reward_cap_mxn: capPesos ?? null,
      amount_due_cents: snap.amountDueCents,
      currency: update.data.currency ?? "MXN",
    },
  });

  const { user } = await getOptionalAuthedUser(req, envRes.env);
  await logCheckEvent(admin, {
    ticketId: ticket.id,
    event: "bill_submitted",
    selfView: user?.id === ticket.consumer_id,
    ipHash,
    userAgent: req.headers.get("user-agent"),
  });

  // Public-safe subset only — the page re-fetches get-ticket for full state.
  return json({
    ok: true,
    check: {
      status: update.data.status,
      bill: {
        check_subtotal_cents: update.data.check_subtotal_cents,
        discount_percent: update.data.discount_percent,
        discount_cents: update.data.discount_cents,
        amount_due_cents: update.data.total_cents,
        reward_cap_mxn: capPesos ?? null,
      },
      currency: update.data.currency ?? "MXN",
    },
  });
});
