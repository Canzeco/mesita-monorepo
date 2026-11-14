"use client";

import { SizedImg } from "@mesita/place-profile";
import { ChevronLeft, MapPin, X } from "lucide-react";
import type { PayPlace } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";

// THE GUEST-LEAD PAY FLOW'S SHARED PIECES (MESITA-3861, Pato's "14. Payments
// Flow Guest-Lead"): the place across the top (Open), the X in the corner,
// the rows card, the three state colours and the Not paid reasons. The
// screens are GuestPayScreen (Open, Bill, Method, App Pay, Cash Pay) and
// GuestTabView (Sign, Confirming, Receipt, Not paid).

/** State colours, used only for state, always with an icon and words. */
export const GOOD = "text-green-700";
export const GOOD_TINT = "bg-green-50";
export const WAIT = "text-amber-700";
export const BAD = "text-red-700";

/** "350 m" / "2.4 km". */
export function distanceText(m: number): string {
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`;
}

/** Why a bill ended unpaid, in one line (money rules, Not paid copy). */
export const NOT_PAID_REASON: Record<string, string> = {
  card_declined: "Your card was declined.",
  bank_check_failed: "Your bank didn't approve it.",
  card_needs_auth: "Your bank didn't approve it.",
  rejected: "The waiter rejected this bill.",
  capture_failed: "The card charge failed.",
  expired: "Ten minutes passed without a signature.",
  hold_released: "Your bank released the card hold.",
  cancelled: "You cancelled this bill.",
};

/** The X in the corner: cancels the bill (or, before one exists, leaves). */
export function CloseX({ onClick, label = "Cancel", light = false }: { onClick: () => void; label?: string; light?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition",
        light ? "bg-black/40 text-white hover:bg-black/55" : "hover:bg-muted text-foreground",
      )}
      data-pay-x
    >
      <X className="h-6 w-6" aria-hidden />
    </button>
  );
}

/** OPEN: the place the guest is at, large across the top: its photo, its
 *  name, a MapPin and the distance. Tapping the name opens the search. Off
 *  greys the photo and says so. */
export function PlaceHero({
  place,
  off,
  onChoose,
  onClose,
  compact = false,
}: {
  place: PayPlace;
  off: boolean;
  onChoose: () => void;
  onClose: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("bg-muted relative w-full shrink-0 overflow-hidden rounded-2xl", compact ? "h-24" : "h-36")} data-pay-hero>
      {place.photo ? (
        <SizedImg src={place.photo} size="card" alt="" className={cn("absolute inset-0 h-full w-full object-cover", off && "grayscale")} />
      ) : null}
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" aria-hidden />
      {off ? (
        <span className="absolute top-3 left-3 rounded-full bg-white px-3 py-1 text-sm font-semibold text-neutral-900" data-pay-off>
          Off
        </span>
      ) : null}
      <span className="absolute top-2 right-2">
        <CloseX onClick={onClose} label="Close" light />
      </span>
      <button
        type="button"
        onClick={onChoose}
        className="absolute inset-x-0 bottom-0 flex flex-col items-start px-4 pb-3 text-left text-white"
        aria-label={`${place.name ?? "This place"}. Choose another place`}
      >
        <span className="font-display max-w-full truncate text-xl font-semibold">{place.name ?? "A Mesita place"}</span>
        <span className="flex items-center gap-1 text-sm text-white/85">
          <MapPin className="h-4 w-4" aria-hidden />
          {place.distance_m !== null ? distanceText(place.distance_m) : "Tap to choose another place"}
        </span>
      </button>
    </div>
  );
}

/** The top of every step after Bill: the place's photo and name, the X. */
export function PlaceBar({ place, onClose }: { place: PayPlace; onClose: () => void }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-3">
      <span className="bg-muted h-9 w-9 shrink-0 overflow-hidden rounded-full" aria-hidden>
        {place.photo ? <SizedImg src={place.photo} size="thumb" alt="" className="h-full w-full object-cover" /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-base font-semibold">{place.name ?? "A Mesita place"}</span>
      <CloseX onClick={onClose} />
    </div>
  );
}

/** One row of a rows card: an icon, a label, the amount on the right. */
export function MoneyRow({
  icon,
  label,
  value,
  strong = false,
  className,
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-11 items-center gap-3 px-4", strong && "font-semibold", className)}>
      {icon ? <span className="text-muted-foreground flex shrink-0 [&>svg]:h-5 [&>svg]:w-5" aria-hidden>{icon}</span> : null}
      <span className={cn("min-w-0 flex-1 truncate", !strong && "text-muted-foreground")}>{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

/** A bordered card of rows with hairline dividers. */
export function RowsCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("border-border divide-border flex flex-col divide-y overflow-hidden rounded-2xl border text-base", className)}>
      {children}
    </div>
  );
}

/** The four steps (MESITA-3878): Open is where the flow starts and the
 *  Receipt where it ends, so neither is a segment. */
export const PAY_FLOW_STEPS = ["Bill", "Method", "Pay", "Sign"] as const;

/** The progress at the top: four labeled segments. Done = ink, current = ink
 *  with its label bold, ahead = grey; `paid` turns them all green. */
export function StepsBar({ at, paid = false, className }: { at: number; paid?: boolean; className?: string }) {
  return (
    <ol className={cn("grid shrink-0 grid-cols-4 gap-1.5", className)} aria-label={`Step ${at + 1} of 4: ${PAY_FLOW_STEPS[at]}`} data-pay-steps>
      {PAY_FLOW_STEPS.map((name, i) => (
        <li key={name} className="flex flex-col gap-1" aria-current={i === at ? "step" : undefined}>
          <span className={cn("h-1.5 rounded-full", paid ? "bg-green-700" : i <= at ? "bg-foreground" : "bg-border")} aria-hidden />
          <span className={cn("text-sm", i === at ? "text-foreground font-semibold" : i < at ? "text-foreground" : "text-muted-foreground")}>{name}</span>
        </li>
      ))}
    </ol>
  );
}

/** One step back, named: "‹ Bill" (MESITA-3878). Leaving is the X. */
export function BackStep({ to, onClick }: { to: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-foreground hover:bg-muted -ml-2 flex h-11 shrink-0 items-center gap-1 self-start rounded-full pr-3 pl-1 text-base font-semibold"
      data-pay-back
    >
      <ChevronLeft className="h-5 w-5" aria-hidden />
      {to}
    </button>
  );
}
