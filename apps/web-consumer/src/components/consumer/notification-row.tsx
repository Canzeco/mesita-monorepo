import { PushLink } from "@/components/consumer/nav/PushLink";
import type { ConsumerNotification } from "@/lib/api/notifications";
import { money } from "@/lib/api/wallet";
import {
  CONSUMER_ROUTES,
  isRouteId,
  reservationPath,
  walletPlacePath,
} from "@/lib/consumer-route-contract";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

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
/** What the place did, as the end of a sentence that starts with its name
 *  ("Taquería Orinoco confirmed your table."). */
function outcomeSentence(outcome: string | null): string {
  switch (outcome) {
    case "confirmed":
      return "confirmed your table.";
    case "declined":
      return "couldn't take your table.";
    case "counter_offer":
      return "offered another time.";
    case "change_proposed":
      return "asked to change your table.";
    case "unreachable":
      return "didn't answer when Mesi called.";
    case "unresolved":
      return "didn't confirm your table yet.";
    default:
      return "updated your reservation.";
  }
}

/** A notification, THE INSTAGRAM WAY (MESITA-4000, Pato: "check Instagram
 *  notification for references"): the place's round photo, then one
 *  sentence with the place in bold and how long ago in grey at its end
 *  ("Taquería Orinoco confirmed your table. 2h"), then a small grey button
 *  when the row leads somewhere. In the list box since MESITA-4053; no day
 *  heading. A credit row opens that place's Loyalty Card, where the credit now
 *  reads Available (the Wallet when it names no place). It was an Activity
 *  row with the time on the right until MESITA-4000. */
export function NotificationRow({ n }: { n: ConsumerNotification }) {
  const credit = n.kind === CREDIT_READY_KIND;
  const placeId = payloadString(n.payload, "place_id");
  const place = payloadString(n.payload, "place_name") ?? "Mesita";
  const photo = payloadString(n.payload, "place_photo_url");
  const sentence = credit
    ? `· ${creditReadyLabel(n.payload)}.`
    : outcomeSentence(payloadString(n.payload, "outcome"));
  // A booking row opens its reservation (MESITA-4053, decision 2B: the
  // "Next up" card left Notifications, so "confirmed your table" carries
  // View, as the ready-to-spend rows do).
  const reservationId = payloadString(n.payload, "reservation_id");
  const href = credit
    ? isRouteId(placeId)
      ? walletPlacePath(placeId)
      : CONSUMER_ROUTES.pay
    : isRouteId(reservationId)
      ? reservationPath(reservationId)
      : undefined;
  const when = timeAgo(n.created_at);
  const body = (
    <>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="bg-muted h-11 w-11 shrink-0 rounded-full" aria-hidden />
      )}
      <p className="min-w-0 flex-1 text-sm leading-snug">
        <span className="font-semibold">{place}</span> {sentence}{" "}
        <span className="text-muted-foreground tabular-nums">{when}</span>
      </p>
      {href ? (
        <span className="bg-muted text-foreground flex h-8 shrink-0 items-center rounded-lg px-3.5 text-sm font-semibold">
          View
        </span>
      ) : null}
    </>
  );
  const cls = "flex items-center gap-3 px-4 py-2.5";
  return (
    <li>
      {href ? (
        <PushLink href={href} className={cn(cls, "hover:bg-muted/40 active:bg-muted/60 transition")}>
          {body}
        </PushLink>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}
