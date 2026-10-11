import Image from "next/image";
import { CalendarCheck, MapPin } from "lucide-react";
import type { ConsumerNotification } from "@/lib/api/notifications";

// The kinds a booking writes — the only rows Me › Notifications renders
// (NotificationsClient filters on this set), so every row is a reservation
// update.
export const RESERVATION_KINDS: ReadonlySet<string> = new Set([
  "reservation",
  "booking",
]);

// `payload` is free-form JSON on the row. The two strings a booking row can
// carry — the place's name and a photo — are read loosely; a payload without
// them renders the pin and "Mesita".
function payloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const v = (payload as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : null;
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

export function NotificationRow({ n }: { n: ConsumerNotification }) {
  const placeName = payloadString(n.payload, "place_name");
  const placePhoto = payloadString(n.payload, "place_photo_url");
  const outcome = payloadString(n.payload, "outcome");

  return (
    <article className="border-border bg-card flex gap-3 overflow-hidden rounded-2xl border p-3">
      <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
        {placePhoto ? (
          <Image
            src={placePhoto}
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
          <p className="text-foreground text-sm leading-snug font-semibold">
            {placeName ?? "Mesita"}
          </p>
        </div>
        <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
          <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
          {outcomeLabel(outcome)}
        </p>
        <p className="text-muted-foreground type-body mt-1">
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
}
