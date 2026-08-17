// Supabase Edge Function — check-web-submit-bill (product caller: the public
// check page)
//
// verify_jwt = FALSE — code-possession auth (see _shared/ticket-check.ts).
// The OPTIONAL billing step (v3b, MESITA-850 — internal control, never a
// gate): staff (whoever holds the scanned QR) may enter the check subtotal
// on check.mesita.ai/<code>; skipping it and closing directly is equally
// valid — the ticket then states the offer for the place's own POS. Pricing is IDENTICAL to the
// retired business-web-submit-ticket-bill path — same grid, same best-of
// resolveTicketRate, same computeTicketBill, same bill notification — minus
// requireMembership, keyed by the check code instead of a business JWT.
//
// Accepted risk, stated in the open: the guest holds their own URL and can
// self-bill. Mesita moves no money — the staff apply the discount off the
// same page — so the exposure is data quality (visit history, and
// recordFirstTicketHonored at mark-paid trusting this surface), not theft.
// Every submit is audit-logged with self_view + ip_hash.
//
// Body:     { code: string, checkSubtotalCents: number }
// Response: { ok: true, check: {bill…} } | 404 | 409 | 429

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { computeTicketBill } from "../_shared/business-ticket-billing.ts";
import { hasMesitaReview, isConsumerFirstVisit } from "../_shared/membership.ts";
import {
  isActionVerified,
  loadRewardsGrid,
  placeStrategy,
  resolveTicketRate,
} from "../_shared/rewards-config.ts";
import { ratesForBilling } from "../_shared/ticket-rate-snapshot.ts";
import { resolveBillCapPesos } from "../_shared/discount-cap.ts";
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
  requireCheckPin,
} from "../_shared/ticket-check.ts";
import { TICKET_STATUS } from "../_shared/ticket-status.ts";

type Body = { code?: string; checkSubtotalCents?: number; pin?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

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

  const ticketRatesRes = await admin
    .from("tickets")
    .select(
      "welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, rates_snapshotted_at",
    )
    .eq("id", ticket.id)
    .maybeSingle();

  // Staff PIN gate (MESITA-823) — write actions only; no-op when the place
  // has no PIN set.
  const pinRes = await requireCheckPin({
    admin,
    projectId: ticket.project_id,
    ticketId: ticket.id,
    pin: bodyRes.body.pin,
    ipHash,
    userAgent: req.headers.get("user-agent"),
    json,
  });
  if (!pinRes.ok) return pinRes.response;

  if (ticket.status !== TICKET_STATUS.open) {
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

  // v10 additive (or legacy best-of fallback) at the place's strategy — the ticket already
  // exists, so exclude it from the first-visit count (Welcome must fire on
  // the create → bill path exactly as it did on scan → bill).
  const grid = await loadRewardsGrid(admin);
  const [firstVisit, mesitaReviewed] = await Promise.all([
    isConsumerFirstVisit(
      admin,
      ticket.consumer_id,
      ticket.project_id,
      ticket.id,
    ),
    hasMesitaReview(admin, ticket.id),
  ]);
  const billingRates = ratesForBilling(
    (ticketRatesRes.data ?? {}) as Record<string, unknown>,
    place as Record<string, unknown>,
  );
  const ratePercent = resolveTicketRate(
    placeStrategy(billingRates as Record<string, unknown>),
    grid,
    {
      classKey: consumerRow.data.class_key,
      isFirstVisit: firstVisit,
      storyVerified: isActionVerified(ticket.story_status),
      reviewVerified: isActionVerified(ticket.review_status),
      mesitaReviewed,
    },
  );
  const capPesos = resolveBillCapPesos(place as Record<string, unknown>, grid.cap);

  const billRes = computeTicketBill({ subtotal, ratePercent, capPesos });
  if (!billRes.ok) {
    return json({ ok: false, code: billRes.code, error: billRes.error }, 400);
  }
  const snap = billRes.snapshot;

  const now = new Date().toISOString();

  // v3 (MESITA-849): the bill never parks a ticket on a story. Tasks are done
  // before the scan, so by now story_status is already settled — and this step
  // must NOT touch it: the old `story_status: pending` reset would have wiped
  // a self-verified story right after pricing with it.
  const update = await admin
    .from("tickets")
    .update({
      status: TICKET_STATUS.awaitingPaymentConfirm,
      check_subtotal_cents: snap.checkSubtotalCents,
      tip_cents: snap.tipCents,
      total_cents: snap.totalCents,
      redeem_cents: 0,
      discount_percent: snap.discountPercent,
      discount_cents: snap.discountCents,
      bill_source: "business", // staff entered it at the check page (MESITA-850)
    })
    .eq("id", ticket.id)
    .eq("status", TICKET_STATUS.open) // concurrent double-submits lose cleanly
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
        // total_cents is the pre-discount bill; the snapshot carries the
        // real amount to charge.
        amount_due_cents: snap.amountDueCents,
        reward_cap_mxn: capPesos ?? null,
      },
      currency: update.data.currency ?? "MXN",
    },
  });
});
