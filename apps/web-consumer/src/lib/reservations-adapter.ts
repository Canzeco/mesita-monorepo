// Adapter: a consumer-web-list-reservations row → the ReservationItem shape
// the reservation UI speaks. Keeping the mapping in one place means the EF
// contract and the view model evolve independently.
//
// THE TICKET LIFECYCLE (the app's model, derived here and nowhere else):
//
//   created   → the ticket exists, the agent hasn't dialed yet
//   booking   → eleven-a1 is calling the venue (incl. counter-offer rounds)
//   confirmed → both sides agreed, the table is yours, slot still ahead
//   passed    → it was confirmed and the slot has come and gone
//   cancelled → called off by the guest, the venue, or an agent
//   failed    → the venue said no, never answered, or the call ended unclear
//
// `passed` is DERIVED (confirmed + slot behind us), never stored — no cron to
// keep honest, and the list EF filters Upcoming/History on the same rule.

import type { EFReservationRow } from "@/lib/api/reservations";
import type {
  ReservationItem,
  ReservationStatus,
} from "@/lib/mock/reservations-mock";

// Mexico City is UTC-6 year-round (no DST since 2022). reserved_at is stored
// with an explicit offset; we render it back in the venue's wall-clock so the
// guest sees the slot they picked.
const TZ = "America/Mexico_City";

// Mirrors PASSED_GRACE_MS in the reservation EFs — you're still at the table.
const PASSED_GRACE_MS = 4 * 3600_000;

function slotPassed(iso: string): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t < Date.now() - PASSED_GRACE_MS;
}

/** The lifecycle phase for a row — the single place this is decided. */
export function reservationPhase(row: EFReservationRow): ReservationStatus {
  switch (row.status) {
    case "cancelled":
      return "cancelled";
    case "declined":
    case "unreachable":
    case "unresolved":
    case "no_show":
      return "failed";
    case "confirmed":
      return slotPassed(row.reserved_at) ? "passed" : "confirmed";
    case "pending":
    default:
      // A pending ticket whose slot went by never got booked — it's over.
      if (slotPassed(row.reserved_at)) return "failed";
      // Dialing started (or is running) → booking; otherwise still just created.
      return (row.call_attempts ?? 0) > 0 || row.attempts_state === "running"
        ? "booking"
        : "created";
  }
}

function noteFor(phase: ReservationStatus, row: EFReservationRow): string | undefined {
  switch (phase) {
    case "created":
      return "Mesita is about to call the place to book your table.";
    case "booking":
      return "Mesita is on the phone with the place — you'll see the answer here.";
    case "passed":
      return "Hope it was great. This table has come and gone.";
    case "cancelled":
      return "This reservation was cancelled.";
    case "failed":
      switch (row.status) {
        case "declined":
          return "The place couldn't take this booking. Try another time.";
        case "unreachable":
          return "The place didn't answer Mesita's calls. Try again or pick another time.";
        case "unresolved":
          return "The call didn't reach a clear answer — Mesita follows up.";
        case "no_show":
          return "Marked as a no-show.";
        default:
          return "This booking didn't go through.";
      }
    default:
      return undefined;
  }
}

function formatReservationWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const weekday = d.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: TZ,
  });
  const monthDay = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });
  return `${weekday} ${monthDay} · ${time}`;
}

export function toReservationItem(row: EFReservationRow): ReservationItem {
  const status = reservationPhase(row);
  // A ticket is still yours to move while it's live and ahead of us.
  const live = status === "created" || status === "booking" || status === "confirmed";
  return {
    id: row.id,
    projectId: row.place?.id ?? "",
    placeName: row.place?.name ?? "Reservation",
    placePhoto: row.place?.photos?.[0] ?? null,
    when: formatReservationWhen(row.reserved_at),
    reservedAt: row.reserved_at,
    partySize: row.party_size,
    status,
    statusNote: noteFor(status, row),
    // The 8-digit code the agents speak on calls — the guest's ticket handle.
    referenceCode: row.reference_code ?? undefined,
    notes: row.notes ?? undefined,
    canCancel: live,
    canReschedule: live,
    // linkedCoupon intentionally omitted: the list EF exposes the coupon by
    // id only (rates/class live on the coupon row).
  };
}
