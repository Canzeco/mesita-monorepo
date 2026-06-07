import type {
  BusinessReservation,
  ReservationStatus,
} from "@/lib/api/reservations";
import {
  isPremiumTier,
  planLabel,
  premiumDoorLabel,
} from "@/lib/consumer-plan";

export function reservationStatusLabel(status: ReservationStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "declined":
      return "Declined";
    case "no_show":
      return "No-show";
    case "cancelled":
      return "Cancelled";
    default:
      return (status as string).replaceAll("_", " ");
  }
}

export function reservationStatusTone(status: ReservationStatus): string {
  switch (status) {
    case "pending":
      return "bg-amber-500/10 text-amber-900";
    case "confirmed":
      return "bg-emerald-500/10 text-emerald-800";
    case "no_show":
      return "bg-violet-500/10 text-violet-800";
    case "declined":
    case "cancelled":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-secondary/10 text-secondary";
  }
}

export function reservationGuestName(r: BusinessReservation): string {
  const name = r.consumer?.full_name?.trim();
  if (name) return name;
  const code = r.consumer?.code?.trim();
  return code ? `Guest ${code}` : "Guest";
}

/** Binary plan, matching the rest of the app: tier_key "premium" → Premium. */
export function reservationPlan(r: BusinessReservation): {
  label: "Premium" | "Free";
  premium: boolean;
  door: string | null;
} {
  const premium = isPremiumTier(r.consumer?.tier_key);
  return {
    label: planLabel(r.consumer?.tier_key),
    premium,
    door: premium ? premiumDoorLabel(r.consumer?.tier_origin) : null,
  };
}

export function reservationWhen(reservedAt: string): {
  date: string;
  time: string;
} {
  const d = new Date(reservedAt);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "" };
  return {
    date: d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

export function reservationPartyLabel(size: number): string {
  return `${size} ${size === 1 ? "guest" : "guests"}`;
}
