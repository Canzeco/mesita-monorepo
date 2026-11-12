import { ActivityRow } from "@/components/consumer/activity/ActivityRow";
import type { ConsumerNotification } from "@/lib/api/notifications";
import { money } from "@/lib/api/wallet";
import { CONSUMER_ROUTES, isRouteId, walletPlacePath } from "@/lib/consumer-route-contract";

// The kinds a booking writes.
export const RESERVATION_KINDS: ReadonlySet<string> = new Set([
  "reservation",
  "booking",
]);

// Pending credit turned Available (MESITA-3293): the settle cron's
// wallet_notify_ready_credit writes one per guest, place and ready time.
export const CREDIT_READY_KIND = "credit_ready";

// Every kind Me › Notifications renders (NotificationsClient filters on this
// set); a kind outside it never reaches the list.
export const NOTIFICATION_KINDS: ReadonlySet<string> = new Set([
  ...RESERVATION_KINDS,
  CREDIT_READY_KIND,
]);

// `payload` is free-form JSON on the row. The two strings a booking row can
// carry — the place's name and a photo — are read loosely; a payload without
// them renders the pin and "Mesita".
function payloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const v = (payload as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function payloadNumber(payload: unknown, key: string): number | null {
  if (!payload || typeof payload !== "object") return null;
  const v = (payload as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** A credit_ready row's line: "MX$550 is ready to spend". */
function creditReadyLabel(payload: unknown): string {
  const cents = payloadNumber(payload, "amount_cents");
  const currency = payloadString(payload, "currency");
  return cents !== null && cents > 0 && currency
    ? `${money(cents, currency)} is ready to spend`
    : "Your credit is ready to spend";
}

// What the place answered, in the guest's words. The writer
// (_shared/reservation-notification.ts) records one of these outcomes.
function outcomeLabel(outcome: string | null): string {
  switch (outcome) {
    case "confirmed":
      return "Your table is confirmed";
    case "declined":
      return "The place couldn't take it";
    case "counter_offer":
      return "The place offered another time";
    case "unreachable":
      return "We couldn't reach the place";
    case "unresolved":
      return "We couldn't confirm it";
    default:
      return "Reservation update";
  }
}

// THE ROW'S BOXES, ONCE (MESITA-2701): NotificationRow and its loading
// silhouette, NotificationRowSkeleton, read the same strings, so a
// silhouette is this row's card, photo and three lines at their sizes (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes").

/** A notification as one Activity row (MESITA-3778, Pato: "in the same
 *  line of rows, don't separate them"): the place's round photo, its name,
 *  what happened under it, the time on the right. Each day's rows sit in one
 *  white card (ActivityRows); they were separate bordered cards with a
 *  square photo until then. A credit row opens that place's House Card,
 *  where the credit now reads Available (the Wallet when it names no place). */
export function NotificationRow({ n }: { n: ConsumerNotification }) {
  const credit = n.kind === CREDIT_READY_KIND;
  const placeId = payloadString(n.payload, "place_id");
  const outcome = payloadString(n.payload, "outcome");
  const time = new Date(n.created_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <ActivityRow
      t={{
        key: n.id,
        place: payloadString(n.payload, "place_name") ?? "Mesita",
        photo: payloadString(n.payload, "place_photo_url"),
        status: { label: time, tone: "grey" },
        big: credit ? creditReadyLabel(n.payload) : outcomeLabel(outcome),
        line: "",
        href: credit
          ? isRouteId(placeId)
            ? walletPlacePath(placeId)
            : CONSUMER_ROUTES.wallet
          : undefined,
      }}
    />
  );
}
