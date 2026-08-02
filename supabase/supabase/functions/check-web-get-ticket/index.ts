// Supabase Edge Function — check-web-get-ticket (natural caller: the public
// check page at mesita.ai/check/<code> — nominally staff, really whoever
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
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  checkNotFound,
  hashRequestIp,
  isRateLimited,
  loadTicketByCheckCode,
  logCheckEvent,
  shapeCheckPayload,
} from "../_shared/ticket-check.ts";
import { loadRewardsGrid } from "../_shared/rewards-config.ts";

type Body = { code?: string };

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

  const ipHash = await hashRequestIp(req, envRes.env.serviceKey);
  // Reads are cheap and re-scans are legitimate — generous ceiling.
  if (await isRateLimited(admin, ipHash, { maxPerMinute: 60 })) {
    return json({ ok: false, error: "Too many requests" }, 429);
  }

  const ticket = await loadTicketByCheckCode(admin, code);
  if (!ticket) return checkNotFound(json);

  const [placeRow, consumerRow, grid] = await Promise.all([
    admin
      .from("projects_view")
      .select("id, name, slug")
      .eq("id", ticket.project_id)
      .maybeSingle(),
    admin
      .from("consumers")
      .select("id, full_name, first_name, instagram_handle")
      .eq("id", ticket.consumer_id)
      .maybeSingle(),
    loadRewardsGrid(admin),
  ]);
  if (!placeRow.data || !consumerRow.data) return checkNotFound(json);

  // Stamp the first public view (conditional, race-safe) BEFORE shaping so
  // the very first scan already reads "scanned just now".
  const wasScanned = ticket.first_scanned_at != null;
  if (!wasScanned) {
    const now = new Date().toISOString();
    await admin
      .from("tickets")
      .update({ first_scanned_at: now })
      .eq("id", ticket.id)
      .is("first_scanned_at", null);
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

  const guest = consumerRow.data;
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
        capMxn: grid.cap ?? null,
      }),
      scanned_before: wasScanned,
    },
  });
});
