// Adapter: a consumer-web-list-reservations row → the ReservationItem shape
// the reservation UI speaks. Keeping the mapping in one place means the EF
// contract and the view model evolve independently.
//
// THE RESERVATION LIFECYCLE (the app's model, derived here and nowhere else):
//
//   created   → the reservation exists, the agent hasn't dialed yet
//   booking   → eleven-a1 is calling the place (incl. counter-offer rounds)
//   confirmed → both sides agreed, the table is yours, slot still ahead
//   passed    → it was confirmed and the slot has come and gone
//   cancelled → called off by the guest, the place, or an agent
//   failed    → the place said no, never answered, or the call ended unclear
//
// `passed` is DERIVED (confirmed + slot behind us), never stored — no cron to
// keep honest, and the list EF filters Upcoming/History on the same rule.

import type { EFReservationRow } from "@/lib/api/reservations";
import { placeTz } from "@mesita/place-profile/lib/place-time";
import type {
  ReservationItem,
  ReservationState,
} from "@/lib/reservation-types";

// reserved_at is an instant; we render it back on the PLACE's wall clock (its
// own zone, MESITA-3626) so the guest sees the slot they picked.

// Mirrors PASSED_GRACE_MS in the reservation EFs — you're still at the table.
const PASSED_GRACE_MS = 4 * 3600_000;

function slotPassed(iso: string): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t < Date.now() - PASSED_GRACE_MS;
}

/** The lifecycle phase for a row — the single place this is decided. */
function reservationPhase(row: EFReservationRow): ReservationState {
  switch (row.state) {
    case "cancelled":
      return "cancelled";
    case "declined":
    case "unreachable":
    case "unresolved":
      return "failed";
    case "confirmed":
      return slotPassed(row.reserved_at) ? "passed" : "confirmed";
    case "pending":
    default:
      // A pending reservation whose slot went by never got booked — it's over.
      if (slotPassed(row.reserved_at)) return "failed";
      // Dialing started (or is running) → booking; otherwise still just created.
      return (row.call_attempts ?? 0) > 0 || row.attempts_state === "running"
        ? "booking"
        : "created";
  }
}

function noteFor(
  phase: ReservationState,
  row: EFReservationRow,
): string | undefined {
  switch (phase) {
    case "created": {
      // The first call waits until the place opens (MESITA-3626): a ticket
      // parked for later says when, on the place's clock.
      const at = row.attempts_state === "scheduled" && row.next_attempt_at
        ? new Date(row.next_attempt_at).getTime()
        : NaN;
      if (Number.isFinite(at) && at > Date.now() + 60_000) {
        return `The place is closed now — Mesita calls when it opens, ${formatReservationWhen(row.next_attempt_at!, row.place?.timezone)}.`;
      }
      return "Mesita is about to call the place to book your table.";
    }
    case "booking": {
      // Leg 1 park states — don't say "on the phone" while waiting for hours.
      if (row.attempts_state === "scheduled") {
        // The parked try (the first call waiting for opening, MESITA-3626, or
        // a retry), on the place's wall clock (MESITA-954).
        const when = row.next_attempt_at
          ? formatReservationWhen(row.next_attempt_at, row.place?.timezone)
          : "";
        return when
          ? `Mesi will call the place when it opens — next try ${when}.`
          : "Mesi will call the place when it opens — you'll see the answer here.";
      }
      if (row.attempts_state === "exhausted") {
        return "The place didn't answer Mesita's calls. Try again or pick another time.";
      }
      // running / answered / null-with-attempts → actively working the reservation.
      return "Mesita is on the phone with the place — you'll see the answer here.";
    }
    case "confirmed": {
      // The terms a1 accepted for the guest (MESITA-4076): a table time
      // limit, a tolerance. Said in the place's words, as a1 recorded them.
      // The time itself is the headline: reserved_at is the booked time,
      // moved by the confirmed outcome when a1 took another time inside the
      // guest's window (MESITA-3957). No terms → no note (MESITA-3649).
      const terms = (row.confirmed_terms ?? "").trim().replace(/[.\s]+$/, "");
      return terms ? `The place's terms: ${terms}.` : undefined;
    }
    // A note never restates the pill (MESITA-3649): passed and cancelled
    // say nothing more.
    case "passed":
    case "cancelled":
      return undefined;
    case "failed":
      switch (row.state) {
        case "declined":
          return "The place couldn't take this booking. Try another time.";
        case "unreachable":
          return "The place didn't answer Mesita's calls. Try again or pick another time.";
        case "unresolved":
          // Terminal (Docs § E): nothing calls again (MESITA-4141).
          return "The call ended without a table. Reserve again.";
        default:
          return undefined;
      }
    default:
      return undefined;
  }
}

function formatReservationWhen(iso: string, tz: string | null | undefined): string {
  const TZ = placeTz(tz);
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

function normalizeClientAlternatives(
  raw: EFReservationRow["alternatives"],
): ReservationItem["alternatives"] {
  if (!Array.isArray(raw)) return undefined;
  const out: NonNullable<ReservationItem["alternatives"]> = [];
  for (const item of raw.slice(0, 8)) {
    if (typeof item === "string") {
      const t = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(item);
      out.push(
        t
          ? { time: `${t[1].padStart(2, "0")}:${t[2]}`, note: item.trim() }
          : { time: "", note: item.trim() },
      );
      continue;
    }
    if (item && typeof item === "object") {
      const time = typeof item.time === "string" ? item.time : "";
      const date = typeof item.date === "string" ? item.date : undefined;
      const note = typeof item.note === "string" ? item.note : undefined;
      if (time || note) {
        out.push({ time, ...(date ? { date } : {}), ...(note ? { note } : {}) });
      }
    }
  }
  return out.length ? out : undefined;
}

/** The place's proposed change, while the guest can still answer it. */
function pendingChangeOf(row: EFReservationRow): ReservationItem["pendingChange"] {
  if (row.state !== "confirmed" || row.change_state !== "proposed") return undefined;
  const exp = row.change_expires_at ? new Date(row.change_expires_at).getTime() : NaN;
  if (!Number.isFinite(exp) || exp <= Date.now()) return undefined;
  const when = row.change_reserved_at
    ? formatReservationWhen(row.change_reserved_at, row.place?.timezone)
    : "";
  const size = row.change_party_size ?? undefined;
  if (!when && !size) return undefined;
  return {
    ...(when ? { when } : {}),
    ...(size ? { partySize: size } : {}),
    ...(row.change_note ? { note: row.change_note } : {}),
  };
}

export function toReservationItem(row: EFReservationRow): ReservationItem {
  const state = reservationPhase(row);
  // A reservation is still yours to move while it's live and ahead of us: the
  // server refuses both once the slot's time passes, with no grace (MESITA-4139).
  const movable =
    (state === "created" || state === "booking" || state === "confirmed") &&
    !(new Date(row.reserved_at).getTime() < Date.now());
  const alternatives = normalizeClientAlternatives(row.alternatives);
  const counterOffer =
    row.state === "pending" && (alternatives?.length ?? 0) > 0;
  const pendingChange = pendingChangeOf(row);
  return {
    id: row.id,
    projectId: row.place?.id ?? "",
    placeName: row.place?.name ?? "Reservation",
    placePhoto: row.place?.photos?.[0] ?? null,
    when: formatReservationWhen(row.reserved_at, row.place?.timezone),
    reservedAt: row.reserved_at,
    placeTimezone: row.place?.timezone ?? null,
    placeHours: row.place?.hours ?? null,
    partySize: row.party_size,
    state,
    stateNote: counterOffer
      ? "The place offered other times — pick one below, or reschedule."
      : pendingChange
      ? "The place asked to change your table. Until you answer, it stays as it is."
      : noteFor(state, row),
    // The 8-digit code the agents speak on calls — the guest's handle on the booking.
    referenceCode: row.reference_code ?? undefined,
    notes: row.notes ?? undefined,
    canCancel: movable,
    canReschedule: movable,
    guestNotify: row.consumer_notify === "app" ? "app" : "call",
    guestConfirmedAt: row.consumer_confirmed_at ?? null,
    alternatives,
    pendingChange,
  };
}
