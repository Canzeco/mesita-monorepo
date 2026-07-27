// Supabase Edge Function — eleven-a2-confirm-reservation (vendor caller)
//
// Caller = eleven-a2: the b2c OUTBOUND Confirmer — the agent leg that calls
// the human guest. Records the guest's confirmation (the consumer side of
// "both sides confirmed"):
//
//   { reference_code, new_date?: "YYYY-MM-DD", new_time?: "HH:mm", note? }
//
// Plain acceptance → guest_confirmed_at stamps. Accepting a venue ALTERNATIVE
// (new_date/new_time, venue-local CDMX) → reserved_at moves AND status returns
// to pending — the venue must re-confirm the new terms, so the negotiation
// loop (follow-up) fires a fresh Booker call. Auth: anon bearer +
// x-agent-secret (see _shared/agent-tools.ts).
//
// Deploy: supabase functions deploy eleven-a2-confirm-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import {
  cleanNote,
  esDate,
  esTime,
  parseVenueLocal,
  requireAgentSecret,
  ticketByCode,
} from "../_shared/agent-tools.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const admin = adminClient(envRes.env);
  const denied = await requireAgentSecret(req, admin);
  if (denied) return denied;

  const body = await readJsonOr<{
    reference_code?: unknown;
    new_date?: unknown;
    new_time?: unknown;
    note?: unknown;
  }>(req, {});

  const ticket = await ticketByCode(admin, body.reference_code);
  if (!ticket) return json({ ok: false, error: "reservation not found for that reference_code" }, 404);
  if (ticket.status === "cancelled") {
    return json({ ok: false, error: "this reservation is cancelled" }, 409);
  }

  const wantsChange = body.new_date !== undefined || body.new_time !== undefined;
  const patch: Record<string, unknown> = {
    guest_confirmed_at: new Date().toISOString(),
  };
  const note = cleanNote(body.note);
  if (note) patch.outcome_note = note;

  if (wantsChange) {
    const next = parseVenueLocal(body.new_date, body.new_time);
    if (!next) {
      return json({
        ok: false,
        error: "new_date must be YYYY-MM-DD and new_time HH:mm (venue-local)",
      }, 400);
    }
    patch.reserved_at = next.toISOString();
    // New terms — the venue hasn't agreed to them yet.
    patch.status = "pending";
    patch.reported_verdict = null;
  }

  const { error } = await admin.from("reservations").update(patch).eq("id", ticket.id);
  if (error) return json({ ok: false, error: error.message }, 500);

  const reservedAt = (patch.reserved_at as string | undefined) ?? ticket.reserved_at;
  return json({
    ok: true,
    guest_confirmed: true,
    changed: wantsChange,
    reference_code: ticket.reference_code,
    date_es: esDate(reservedAt),
    time_es: esTime(reservedAt),
    needs_new_venue_call: wantsChange,
  });
});
