// Adapter: a consumer-web-list-reservations row → the ReservationItem shape
// the parked reservation UI (ReservationCard / ReservationDetailBody) already
// speaks. Keeping the mapping in one place means the EF contract and the view
// model evolve independently.

import type { EFReservationRow } from "@/lib/api/reservations";
import type {
  ReservationItem,
  ReservationStatus,
} from "@/lib/mock/reservations-mock";

// Mexico City is UTC-6 year-round (no DST since 2022). reserved_at is stored
// with an explicit offset; we render it back in the venue's wall-clock so the
// guest sees the slot they picked.
const TZ = "America/Mexico_City";

// The card models three visual states. pending = still booking, confirmed =
// booked; every terminal outcome (declined / no_show / cancelled) collapses
// to the muted "cancelled" treatment.
function toCardStatus(status: EFReservationRow["status"]): ReservationStatus {
  if (status === "pending") return "booking";
  if (status === "confirmed") return "booked";
  return "cancelled";
}

function noteFor(status: EFReservationRow["status"]): string | undefined {
  switch (status) {
    case "pending":
      return "Mesita is calling the place to confirm your table.";
    case "declined":
      return "The place couldn't take this booking.";
    case "no_show":
      return "Marked as a no-show.";
    case "cancelled":
      return "This reservation was cancelled.";
    case "unreachable":
      return "The place didn't answer Mesita's calls. Try again or pick another time.";
    case "unresolved":
      return "The call didn't reach a clear answer — Mesita follows up.";
    default:
      return undefined;
  }
}

export function formatReservationWhen(iso: string): string {
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
  return {
    id: row.id,
    projectId: row.place?.id ?? "",
    placeName: row.place?.name ?? "Reservation",
    placePhoto: row.place?.photos?.[0] ?? null,
    when: formatReservationWhen(row.reserved_at),
    partySize: row.party_size,
    status: toCardStatus(row.status),
    statusNote: noteFor(row.status),
    // The 8-digit code the agents speak on calls — the guest's ticket handle.
    referenceCode: row.reference_code ?? undefined,
    // linkedCoupon intentionally omitted: the list EF exposes the coupon by
    // id only (rates/class live on the coupon row), and cross-looking it up
    // is out of scope for MESITA-715.
  };
}
