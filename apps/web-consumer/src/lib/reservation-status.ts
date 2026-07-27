// One source of truth for how each ticket lifecycle phase looks and reads.
// Shared by the list card and the detail body so a reservation never wears
// two different faces. The phases themselves are derived in
// lib/reservations-adapter.ts (reservationPhase).

import {
  CalendarCheck,
  CheckCircle2,
  CircleSlash,
  Clock,
  PhoneCall,
  X,
} from "lucide-react";
import type { ReservationStatus } from "@/lib/mock/reservations-mock";

type ReservationStatusMeta = {
  label: string;
  /** Pill styling — border + tint + text, semantic tokens only. */
  pillClass: string;
  Icon: typeof Clock;
  iconClass: string;
  /** Muted/struck treatment for the finished-and-not-happening phases. */
  spent: boolean;
  /** Fallback banner when the row carries no statusNote. */
  banner: string | null;
};

export const RESERVATION_STATUS_META: Record<ReservationStatus, ReservationStatusMeta> = {
  created: {
    label: "Created",
    pillClass: "border-sky-500/30 bg-sky-50 text-sky-800",
    Icon: CalendarCheck,
    iconClass: "text-sky-600",
    spent: false,
    banner: "Mesita is about to call the place to book your table.",
  },
  booking: {
    label: "Booking",
    pillClass: "border-amber-500/30 bg-amber-50 text-amber-800",
    Icon: PhoneCall,
    iconClass: "text-amber-600",
    spent: false,
    banner:
      "We're booking this for you — you'll get the answer here as soon as the place replies.",
  },
  confirmed: {
    label: "Confirmed",
    pillClass: "border-emerald-500/30 bg-emerald-50 text-emerald-800",
    Icon: CheckCircle2,
    iconClass: "text-emerald-600",
    spent: false,
    banner: null,
  },
  passed: {
    label: "Passed",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: Clock,
    iconClass: "text-muted-foreground",
    spent: true,
    banner: "Hope it was great. This table has come and gone.",
  },
  cancelled: {
    label: "Cancelled",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: X,
    iconClass: "text-muted-foreground",
    spent: true,
    banner: "This reservation was cancelled.",
  },
  failed: {
    label: "Not booked",
    pillClass: "border-rose-500/30 bg-rose-50 text-rose-800",
    Icon: CircleSlash,
    iconClass: "text-rose-600",
    spent: true,
    banner: "This booking didn't go through.",
  },
};

/** The happy path, in order — the detail view renders it as a stepper. */
export const RESERVATION_FLOW: ReservationStatus[] = [
  "created",
  "booking",
  "confirmed",
  "passed",
];

export function statusMeta(status: ReservationStatus): ReservationStatusMeta {
  return RESERVATION_STATUS_META[status] ?? RESERVATION_STATUS_META.created;
}
