// Supabase Edge Function — consumer-web-create-ticket (product caller)
//
// Tickets v2 (MESITA-806): the guest creates their own reward ticket BEFORE
// staff involvement. Pick the place, opt into the story rung (any class with
// a connected Instagram — MESITA-909), get back a check_code — the QR the
// app renders is https://check.mesita.ai/<check_code>, and everything
// staff-side happens on that public page (check-web-*). Replaces
// staff-initiated creation (business-web-create-ticket, retired in the same
// change).
//
// Welcome is NEVER asserted here: it is detected server-side at billing time
// (isConsumerFirstVisit inside check-web-submit-bill). The story opt-in is
// re-checked against Instagram connection + the place's grid (offersAction);
// a non-eligible opt-in silently downgrades to not_required — same posture
// the old staff create had, and the class never leaks in the response.
//
// Pick-one (MESITA wizard, D6): `chosenReward` names the ONE action that
// gates the QR — the chosen action opens at 'pending', the other stays
// 'not_required', and clients render/gate only non-'not_required' tasks.
// 'base' opens no task at all (QR scannable at the class base rate).
// Legacy callers without `chosenReward` keep the old wantsStory behavior
// byte-for-byte (review_status stays at its 'not_required' default).
// Best-of billing is untouched: a guest who later completes a non-chosen
// action anyway still gets it counted (resolveLiveTicketRate reads verified
// statuses, not 'pending' markers).
//
// Body:     { placeId: string, wantsStory?: boolean,
//             chosenReward?: "story" | "review" | "base" }
// Response: { ok: true, ticket: {...}, checkUrl } | { ok, error, code? }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  assessPromoLane,
  loadMembershipRow,
} from "../_shared/membership-enforcement.ts";
import { isPlacePromoting } from "../_shared/place-promoting.ts";
import {
  loadRewardsGrid,
  offersAction,
  placeStrategy,
} from "../_shared/rewards-config.ts";
import { checkUrlFor, newCheckCode } from "../_shared/ticket-check.ts";
import { CHECK_DEDUPE_STATUSES, TICKET_STATUS } from "../_shared/ticket-status.ts";
import { snapshotRatesFromPlace } from "../_shared/ticket-rate-snapshot.ts";
import { writeTicket } from "../_shared/ticket-doc.ts";

type Body = {
  placeId?: string;
  projectId?: string;
  wantsStory?: boolean;
  chosenReward?: string;
};

const CHOSEN_REWARDS = new Set(["story", "review", "base"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const consumerId = authRes.user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const placeId = readPlaceIdAlias(body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);
  const chosenRaw = body.chosenReward;
  if (chosenRaw !== undefined && !CHOSEN_REWARDS.has(chosenRaw)) {
    return json(
      { ok: false, error: "chosenReward must be story, review, or base" },
      400,
    );
  }
  const chosen = chosenRaw as "story" | "review" | "base" | undefined;
  // Legacy path (no chosenReward): wantsStory keeps its old meaning; the
  // pick-one path maps story-choice onto the same eligibility check.
  const wantsStory = chosen ? chosen === "story" : body.wantsStory === true;

  const admin = adminClient(envRes.env);

  const placeRow = await admin
    .from("profiles")
    .select(
      "id, name, slug, status, listing_type, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate",
    )
    .eq("id", placeId)
    .maybeSingle();
  if (placeRow.error) {
    return json(
      { ok: false, error: `place_lookup: ${placeRow.error.message}` },
      500,
    );
  }
  if (!placeRow.data) return json({ ok: false, error: "Place not found" }, 404);
  const place = placeRow.data;
  if (place.status === "archived") {
    return json({ ok: false, error: "Place is archived" }, 409);
  }
  // The place must be PROMOTING — paying, a strategy above Zero, and an open
  // promo lane. This used to gate on `listing_type = 'partner'` plus a
  // separate lane check; the enum is derived only when something writes the
  // place, so it could equally block a place that had just started promoting
  // and pass one whose lane had since closed. Same computation the consumer
  // surfaces now render from, so an enabled button and a 409 can no longer
  // disagree (MESITA-1150). Error CODES are unchanged: callers switch on them.
  const membershipRow = await loadMembershipRow(admin, placeId);
  if (membershipRow) {
    const lane = assessPromoLane(membershipRow);
    if (!lane.open) {
      return json(
        {
          ok: false,
          // Consumer-facing wording; the es-MX staffMessage stays staff-side.
          error: "This place isn't running Mesita rewards right now.",
          code: lane.code,
        },
        409,
      );
    }
  }
  if (!isPlacePromoting({ ...(membershipRow ?? {}), ...place })) {
    return json(
      {
        ok: false,
        error: "This place isn't running a Mesita reward right now.",
        code: "not_partner",
      },
      409,
    );
  }

  // One LIVE self-created ticket per guest × place — friendly check first,
  // the partial unique index wins any race.
  const existing = await admin
    .from("visit_tickets")
    .select("id, check_code, status")
    .eq("consumer_id", consumerId)
    .eq("project_id", placeId)
    .in("status", [...CHECK_DEDUPE_STATUSES])
    .not("check_code", "is", null)
    .maybeSingle();
  if (existing.data) {
    return json(
      {
        ok: false,
        error: "You already have an open ticket at this place.",
        code: "already_open",
        ticketId: existing.data.id,
      },
      409,
    );
  }

  // Story opt-in (MESITA-909): any class with a connected Instagram
  // (`instagram_handle` set) AND the place's strategy must actually offer
  // the rung. Anything else downgrades silently — never an error, so the
  // response can't be used to probe class or Instagram state.
  let storyStatus = "not_required";
  if (wantsStory) {
    const consumerRow = await admin
      .from("consumers")
      .select("id, instagram_handle")
      .eq("id", consumerId)
      .maybeSingle();
    if (consumerRow.error || !consumerRow.data) {
      return json({ ok: false, error: "Consumer not found" }, 404);
    }
    const igConnected = Boolean(consumerRow.data.instagram_handle?.trim());
    if (igConnected) {
      const grid = await loadRewardsGrid(admin);
      if (offersAction(placeStrategy(place), grid, "story")) {
        storyStatus = "pending";
      }
    }
  }

  // Pick-one (D6): the chosen action opens 'pending'; the other stays
  // 'not_required'. A story choice that failed eligibility above falls back
  // to the review rung (same silent-downgrade posture) so the ticket is
  // never gate-less by accident. Zero-strategy places offer no rungs — both
  // stay 'not_required' and the QR is scannable at whatever the table gives.
  let reviewStatus = "not_required";
  if (
    chosen === "review" ||
    (chosen === "story" && storyStatus === "not_required")
  ) {
    const grid = await loadRewardsGrid(admin);
    if (offersAction(placeStrategy(place), grid, "review")) {
      reviewStatus = "pending";
    }
  }

  // Insert with a fresh 128-bit code; regenerate once on the astronomically
  // unlikely collision. The consumer×place race lands here too (23505 on the
  // partial index) and maps to the friendly 409 above.
  let inserted: Record<string, unknown> | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 2 && !inserted; attempt++) {
    const res = await writeTicket(admin, {
      mode: "insert",
      patch: {
        project_id: placeId,
        consumer_id: consumerId,
        opened_by: consumerId, // self-opened: the v2 marker
        status: TICKET_STATUS.open,
        story_status: storyStatus as "not_required" | "pending",
        review_status: reviewStatus as "not_required" | "pending",
        check_code: newCheckCode(),
        ...snapshotRatesFromPlace(place as Record<string, unknown>),
      },
      select:
        "id, status, story_status, review_status, check_code, first_scanned_at, currency, created_at",
    });
    if (res.ok) {
      inserted = res.row;
      break;
    }
    lastError = res.error;
    if (res.code === "23505") {
      if (res.error.includes("tickets_one_open_check_per_consumer_place")) {
        return json(
          {
            ok: false,
            error: "You already have an open ticket at this place.",
            code: "already_open",
          },
          409,
        );
      }
      continue; // check_code collision — regenerate
    }
    break;
  }
  if (!inserted) {
    return json({ ok: false, error: `ticket_insert: ${lastError}` }, 500);
  }

  return json({
    ok: true,
    ticket: {
      ...inserted,
      place_name: place.name,
      place_slug: place.slug ?? null,
    },
    checkUrl: checkUrlFor(inserted.check_code as string),
  }, 201);
});
