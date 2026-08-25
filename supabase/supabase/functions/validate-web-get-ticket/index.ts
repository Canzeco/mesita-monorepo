// Supabase Edge Function — validate-web-get-ticket (product caller: the public
// check page at check.mesita.ai/<code> — nominally staff, really whoever
// holds the freshly scanned QR)
//
// verify_jwt = FALSE. The 128-bit check_code IS the authentication; see the
// security-model note in _shared/ticket-check.ts. This endpoint is the
// authenticity proof: it renders the ticket's live state on an official
// Mesita domain. Re-scans are a feature (staff re-check anytime); the FIRST
// view stamps first_scanned_at so the page can say "first opened N min ago".
//
// The response is shaped EXCLUSIVELY by shapeCheckPayload — the public
// allowlist. Never returns class, rungs, consumer code, or UUIDs.
//
// Body:     { code: string }
// Response: { ok: true, check: {...} } | 404 uniform miss | 429

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  checkNotFound,
  hashRequestIp,
  isRateLimited,
  loadCheckSettings,
  loadTicketByCheckCode,
  logCheckEvent,
  shapeCheckPayload,
} from "../_shared/ticket-check.ts";
import { loadRewardsGrid } from "../_shared/rewards-config.ts";
import { resolveBillCapPesos } from "../_shared/discount-cap.ts";
import { resolveLiveTicketRate } from "../_shared/ticket-reprice.ts";
import { TICKET_STATUS } from "../_shared/ticket-status.ts";
import { writeTicket } from "../_shared/ticket-doc.ts";
import { loadVisitsConfig, staffVisitsPolicy } from "../_shared/visits-config.ts";

type Body = { code?: string };

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

  const ipHash = await hashRequestIp(req, envRes.env.serviceKey);
  // Reads are cheap and re-scans are legitimate — generous ceiling.
  if (await isRateLimited(admin, ipHash, { maxPerMinute: 60 })) {
    return json({ ok: false, error: "Too many requests" }, 429);
  }

  const ticket = await loadTicketByCheckCode(admin, code);
  if (!ticket) return checkNotFound(json);

  const [placeRow, consumerRow, grid, checkSettings] = await Promise.all([
    admin
      .from("profiles")
      .select("id, name, slug, monthly_promo_cap")
      .eq("id", ticket.project_id)
      .maybeSingle(),
    admin
      .from("consumers")
      .select("id, full_name, first_name, instagram_handle")
      .eq("id", ticket.consumer_id)
      .maybeSingle(),
    loadRewardsGrid(admin),
    loadCheckSettings(admin, ticket.project_id),
  ]);
  if (!placeRow.data || !consumerRow.data) return checkNotFound(json);

  // Stamp the first public view (conditional, race-safe) BEFORE shaping so
  // the very first scan already reads "scanned just now".
  const wasScanned = ticket.first_scanned_at != null;
  if (!wasScanned) {
    const now = new Date().toISOString();
    await writeTicket(admin, {
      mode: "update",
      id: ticket.id,
      patch: { first_scanned_at: now },
      guard: { is: { first_scanned_at: null } },
    });
    ticket.first_scanned_at = now;
  }

  // self_view: the request carried the OWNER's consumer JWT (the app's own
  // status poll, or lazy in-app self-service). Anonymous browsers are null.
  const { user } = await getOptionalAuthedUser(req, envRes.env);
  const selfView = user?.id === ticket.consumer_id;

  await logCheckEvent(admin, {
    ticketId: ticket.id,
    event: "scanned",
    selfView,
    ipHash,
    userAgent: req.headers.get("user-agent"),
  });

  // v3b (MESITA-850): with the bill optional, an unbilled live ticket must
  // state the commitment — "N% off, up to MX$<cap>" — so staff can apply it
  // at their own POS and close. Resolve the live best-of rate only when the
  // page will actually show it; a failed resolve degrades to no offer block
  // rather than failing the scan.
  let offerRatePercent: number | null = null;
  let liveCapPesos: number | null = null;
  const unbilled = (ticket.total_cents ?? 0) <= 0 &&
    (ticket.bill_subtotal_cents ?? 0) <= 0;
  if (unbilled && ticket.status === TICKET_STATUS.open) {
    const live = await resolveLiveTicketRate(admin, ticket);
    if (live.ok) {
      offerRatePercent = live.ratePercent;
      liveCapPesos = live.capPesos;
    }
  }

  const guest = consumerRow.data;
  const visits = staffVisitsPolicy(await loadVisitsConfig(admin));
  return json({
    ok: true,
    check: {
      ...shapeCheckPayload({
        ticket,
        placeName: placeRow.data.name,
        placeSlug: placeRow.data.slug ?? null,
        guestDisplayName: guest.full_name?.trim() ||
          guest.first_name?.trim() || "Mesita guest",
        guestInstagramHandle: guest.instagram_handle ?? null,
        capMxn: liveCapPesos ??
          resolveBillCapPesos(
            placeRow.data as Record<string, unknown>,
            grid.cap,
          ),
        // MESITA-1120: get-ticket never gates, so it may degrade — but it
        // must not answer `false` on an errored read, or the page hides the
        // PIN input and staff cannot complete an action the write EF will
        // then demand a PIN for. Unknown resolves to "prompt".
        pinRequired: checkSettings.loadFailed || checkSettings.pin != null,
        offerRatePercent,
        // MESITA-1095: the guest bill is always required.
        billRequired: true,
      }),
      visits,
      scanned_before: wasScanned,
    },
  });
});
