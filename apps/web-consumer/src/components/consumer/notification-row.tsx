import Link from "next/link";
import { SizedImage } from "@mesita/place-profile";
import { CalendarCheck, MapPin, WalletCards } from "lucide-react";
import { Skeleton, SkeletonLine } from "@/components/shared";
import type { ConsumerNotification } from "@/lib/api/notifications";
import { money } from "@/lib/api/wallet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
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

/** The white bordered card, the photo beside the words. */
const ROW_CARD =
  "border-border bg-card flex gap-3 overflow-hidden rounded-2xl border p-3";
/** The 64px place photo. */
const ROW_PHOTO = "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl";
/** The place name, 14px snug. */
const ROW_NAME = "text-sm leading-snug";
/** The outcome, 12px, 2px under the name. */
const ROW_OUTCOME = "mt-0.5 text-xs";
/** The date, 13px body, 4px under the outcome. */
const ROW_DATE = "type-body mt-1";

export function NotificationRow({ n }: { n: ConsumerNotification }) {
  const placeName = payloadString(n.payload, "place_name");
  const placePhoto = payloadString(n.payload, "place_photo_url");
  const outcome = payloadString(n.payload, "outcome");
  const credit = n.kind === CREDIT_READY_KIND;
  const Icon = credit ? WalletCards : CalendarCheck;

  const card = (
    <article className={ROW_CARD}>
      <div className={cn("bg-muted", ROW_PHOTO)}>
        {placePhoto ? (
          <SizedImage
            src={placePhoto}
            size="thumb"
            alt=""
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            <MapPin className="h-5 w-5 opacity-40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-foreground font-semibold", ROW_NAME)}>
            {placeName ?? "Mesita"}
          </p>
        </div>
        <p
          className={cn(
            "text-muted-foreground flex items-center gap-1.5",
            ROW_OUTCOME,
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {credit ? creditReadyLabel(n.payload) : outcomeLabel(outcome)}
        </p>
        <p className={cn("text-muted-foreground", ROW_DATE)}>
          {new Date(n.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
    </article>
  );

  // A credit row opens the Wallet, where the credit now reads Available.
  return credit ? (
    <Link href={CONSUMER_ROUTES.wallet} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

/** A NotificationRow before the feed lands: its card, the photo's box, and
 *  a bar on each of its three lines (SkeletonLine, the line's own height).
 *  Every word is data, so none is drawn. It sat in components/shared as
 *  SkeletonRow, a copy of this row's classes (MESITA-2701). */
export function NotificationRowSkeleton() {
  return (
    <div aria-hidden className={ROW_CARD}>
      <Skeleton className={ROW_PHOTO} />
      <div className="min-w-0 flex-1">
        <SkeletonLine className={ROW_NAME} bar="w-2/5" />
        <SkeletonLine className={ROW_OUTCOME} bar="w-3/5" />
        <SkeletonLine className={ROW_DATE} bar="w-1/3" />
      </div>
    </div>
  );
}
