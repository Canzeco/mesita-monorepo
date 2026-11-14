// Supabase Edge Function — admin-web-list-reservations
//
// MESITA-3960 (Pato: "in Manage add Reservation to view all the reservation
// tickets"): every reservation ticket, newest first, read-only, for admin's
// Manage › Reservations. Each row carries the table (when, party, the name it
// is under, reference, notes), its state, the place it is at and the guest
// who asked (first name and member number). Test tickets come back flagged,
// never hidden: the operator should see what the test line did.
//
// Body: {} (ignored)
// Response: { ok: true, capped, reservations: AdminReservation[] }
//   AdminReservation = { id, reserved_at, party_size, state, passed,
//     reference_code, notes, guest_first_name, guest_last_name, is_test,
//     attempts_state, created_at, confirmed_at, cancelled_at,
//     consumer_id, consumer_first_name, member_number,
//     place: { id, slug, name, timezone } | null }
//   capped is true only when more than ROW_CAP rows exist.
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";
import { PASSED_GRACE_MS } from "../_shared/reservation-doc.ts";

const ROW_CAP = 500;
// `.in()` travels in the GET query string; look ids up in slices.
const LOOKUP_CHUNK = 100;

type TicketRow = {
  id: string;
  reserved_at: string;
  party_size: number;
  state: string;
  reference_code: string | null;
  notes: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  is_test: boolean | null;
  attempts_state: string | null;
  created_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  consumer_id: string | null;
  place_id: string | null;
};
type GuestRow = { id: string; first_name: string | null; code: string | null };

serveJson("admin-web-list-reservations", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const { data, error } = await admin
    .from("reservation_tickets")
    .select(
      "id, reserved_at, party_size, state, reference_code, notes, guest_first_name, guest_last_name, is_test, attempts_state, created_at, confirmed_at, cancelled_at, consumer_id, place_id",
    )
    .order("created_at", { ascending: false })
    .order("id")
    .limit(ROW_CAP + 1);
  if (error) {
    console.error("[admin-web-list-reservations] tickets_read", error.message);
    return json({ ok: false, error: `tickets_read: ${error.message}` }, 500);
  }
  const all = (data ?? []) as TicketRow[];
  const capped = all.length > ROW_CAP;
  const rows = all.slice(0, ROW_CAP);

  const guests = new Map<string, GuestRow>();
  const consumerIds = [...new Set(rows.map((r) => r.consumer_id).filter((v): v is string => !!v))];
  for (let i = 0; i < consumerIds.length; i += LOOKUP_CHUNK) {
    const g = await admin
      .from("consumers")
      .select("id, first_name, code")
      .in("id", consumerIds.slice(i, i + LOOKUP_CHUNK));
    if (g.error) {
      console.error("[admin-web-list-reservations] guests_read", g.error.message);
      return json({ ok: false, error: `guests_read: ${g.error.message}` }, 500);
    }
    for (const row of (g.data ?? []) as GuestRow[]) guests.set(row.id, row);
  }

  // attachPlaces does one `.in()` per call; keep each under the URL limit.
  const withPlaces: Awaited<ReturnType<typeof attachPlaces<TicketRow>>> = [];
  for (let i = 0; i < rows.length; i += LOOKUP_CHUNK) {
    withPlaces.push(...(await attachPlaces(admin, rows.slice(i, i + LOOKUP_CHUNK))));
  }

  // "Passed" is derived, never stored (same rule as the guest's list): a
  // confirmed table whose time is more than PASSED_GRACE_MS behind us.
  const passedCutoff = Date.now() - PASSED_GRACE_MS;

  return json({
    ok: true,
    capped,
    reservations: withPlaces.map((r) => {
      const guest = r.consumer_id ? guests.get(r.consumer_id) : undefined;
      return {
        id: r.id,
        reserved_at: r.reserved_at,
        party_size: r.party_size,
        state: r.state,
        passed: r.state === "confirmed" && Date.parse(r.reserved_at) < passedCutoff,
        reference_code: r.reference_code,
        notes: r.notes,
        guest_first_name: r.guest_first_name,
        guest_last_name: r.guest_last_name,
        is_test: r.is_test === true,
        attempts_state: r.attempts_state,
        created_at: r.created_at,
        confirmed_at: r.confirmed_at,
        cancelled_at: r.cancelled_at,
        consumer_id: r.consumer_id,
        consumer_first_name: guest?.first_name?.trim() || null,
        member_number: guest?.code ?? null,
        place: r.place
          ? { id: r.place.id, slug: r.place.slug, name: r.place.name, timezone: r.place.timezone }
          : null,
      };
    }),
  });
});
