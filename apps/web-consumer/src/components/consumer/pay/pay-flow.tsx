"use client";

import { createContext, useContext, useEffect } from "react";
import { SizedImg } from "@mesita/place-profile";
import { Check, ChevronLeft, MapPin, X } from "lucide-react";
import { STRIP_STEPS } from "@/lib/guest-pay-stages";
import { useRouter } from "next/navigation";
import type { PayPlace } from "@/lib/api/wallet";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/shared/Panel";
import { Spinner } from "@/components/shared/Spinner";
import { goBack } from "@/lib/navigate";
import { cn } from "@/lib/utils";

// THE GUEST-LEAD PAY FLOW'S SHARED PIECES (MESITA-3861, Pato's "14. Payments
// Flow Guest-Lead"): the place across the top (Open), the X in the corner,
// the rows card, the three state colours, the Not paid reasons, the header
// title and the steps strip. The screens are GuestPayScreen (Bill, Tip,
// Method, Pay) and GuestTabView (Confirm, Confirming, Receipt, Not paid).

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
  expired: "Time ran out before the waiter confirmed.",
  hold_released: "Your bank released the card hold.",
  cancelled: "You cancelled this bill.",
};

/** The X at the top left, beside the title in the header (MESITA-3880).
 *  It closes and keeps the ticket; cancelling is its own button (MESITA-3908). */
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

/** The X while a bill loads (MESITA-3997): the same X the loaded steps
 *  show, so the header never swaps a boxed Back for it. It just leaves. */
export function PayLeaveX() {
  const router = useRouter();
  return <CloseX onClick={() => goBack(router)} label="Close" />;
}

/** OPEN: the place the guest is at, large across the top: its photo, its
 *  name, a MapPin and the distance. Tapping the name opens the search. Off
 *  greys the photo and says so. */
export function PlaceHero({
  place,
  off,
  onChoose,
  compact = false,
}: {
  place: PayPlace;
  off: boolean;
  onChoose: () => void;
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
      <button
        type="button"
        onClick={onChoose}
        className="absolute inset-x-0 bottom-0 flex flex-col items-start px-4 pb-3 text-left text-white"
        aria-label={`${place.name ?? "This place"}. Choose another place`}
      >
        <span className="max-w-full truncate text-xl font-semibold">{place.name ?? "A Mesita place"}</span>
        <span className="flex items-center gap-1 text-sm text-white/85">
          <MapPin className="h-4 w-4" aria-hidden />
          {place.distance_m !== null ? distanceText(place.distance_m) : "Tap to choose another place"}
        </span>
      </button>
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

/** A step's body: its panels stacked FROM THE TOP, 16px apart, the empty
 *  room below them (MESITA-4077, Pato: "why is the bill box so separated
 *  from the steps box. optimize vertical space a lot"; MESITA-4061 had
 *  centred the group both ways). Scrolls when taller than the screen; the
 *  footer never moves. */
export function StepBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="scrollbar-thin-dark -mx-4 flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
      <div className={cn("flex w-full flex-col items-stretch gap-4 py-4 text-center", className)}>{children}</div>
    </div>
  );
}

// ONE CLEAN TICKET (Pato, 2026-11-21, MESITA-4600: "all the steps in the
// same ticket. all the ticket must have x, don't list the steps with the
// progress bar [at the top]. don't even mention the place. keep all cleaner
// … bottom must have steps. 1. Show place, 2 …"): every screen of the ticket
// wears the picker's frame (MESITA-4598): the screen's question at the left
// of the header, ✕ at the right, no place name or photo; the steps sit at
// the bottom, over the step's one button. The boxed "‹ Bill · 1 of 3 ›" bar
// with the place over it (MESITA-4061/4072/4122) is gone.

/** What a screen puts in the page header: its title, and whether ← steps back. */
export type PayHead = { title: string; back: boolean };

/** Set by the bill's page (PayTabScreen); each screen hands it its head. */
export const PayHeadContext = createContext<((h: PayHead | null) => void) | null>(null);

/** A screen's header: renders nothing, tells the page header what to say. */
export function PayTitle({ title, back = false }: { title: string; back?: boolean }) {
  const setHead = useContext(PayHeadContext);
  useEffect(() => {
    setHead?.({ title, back });
  }, [setHead, title, back]);
  useEffect(() => () => setHead?.(null), [setHead]);
  return null;
}

/** THE TICKET'S HEADER (MESITA-4598/4600), the picker sheet's and every
 *  step's: ← (only where it steps back), the question at the left in 20px
 *  semibold, a 44px ✕ at the right, a hairline under. One component so the
 *  sheet and the page read as one ticket. */
export function TicketHeader({ title, onBack, onClose, closeLabel = "Close" }: { title: string; onBack?: () => void; onClose?: () => void; closeLabel?: string }) {
  return (
    <div className={cn("border-border bg-card flex min-h-[3.75rem] shrink-0 items-center gap-1 border-b py-2 pr-3", onBack ? "pl-2" : "pl-5")} data-pay-head>
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="Back" className="hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition" data-pay-back>
          <ChevronLeft className="h-6 w-6" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
      <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">{title}</h1>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label={closeLabel} className="hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition" data-pay-close>
          <X className="h-6 w-6" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** THE STEPS, AT THE BOTTOM (MESITA-4600): "1 Place · 2 Bill · 3 Tip · 4 Pay"
 *  in one row, a thin bar under each, done and current in ink, the current
 *  one semibold, the rest grey. A picture, not buttons: ← steps back.
 *  `at` "done" (the Receipt) lights all four, a check on the last. */
export function StepStrip({ at, className }: { at: 1 | 2 | 3 | 4 | "done"; className?: string }) {
  const n = at === "done" ? 5 : at;
  return (
    <ol
      className={cn("grid shrink-0 grid-cols-4 gap-1.5", className)}
      aria-label={at === "done" ? "All steps done" : `Step ${at} of 4: ${STRIP_STEPS[at - 1]}`}
      data-pay-strip
    >
      {STRIP_STEPS.map((name, i) => {
        const step = i + 1;
        const done = step < n;
        const current = step === n;
        return (
          <li key={name} aria-current={current ? "step" : undefined} className="flex min-w-0 flex-col gap-1.5">
            <span className={cn("h-1 rounded-full", done || current ? "bg-foreground" : "bg-border")} aria-hidden />
            <span
              className={cn(
                "flex min-w-0 items-center gap-1 truncate text-xs tabular-nums",
                current ? "text-foreground font-semibold" : done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {at === "done" && step === 4 ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden /> : <span>{step}</span>}
              <span className="truncate">{name}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** A step's section (MESITA-4072): the shared Panel, left-aligned inside
 *  the centred step body, full width. */
export function PaySection({
  title,
  action,
  className,
  children,
  ...data
}: {
  title?: string;
  /** On the heading's right (MESITA-4082: the Bill step's typed amount). */
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  [key: `data-${string}`]: string | boolean | undefined;
}) {
  return (
    <Panel title={title} action={action} className={cn("w-full shrink-0 text-left", className)} {...data}>
      {children}
    </Panel>
  );
}

/** The bottom of a step, pinned under a full-width hairline (MESITA-4600):
 *  the steps, then the step's one dark button, full width. The red Cancel
 *  bill left the steps before the bill opens: the ✕ throws the ticket away
 *  (MESITA-4598). Confirm keeps a small outlined Cancel bill (a card is held
 *  there; its ✕ only closes, MESITA-4126/3908). */
export function StepFooter({
  strip,
  primary,
  onCancel,
  cancelDisabled = false,
}: {
  strip?: 1 | 2 | 3 | 4 | "done" | null;
  primary?: { label: React.ReactNode; onClick: () => void; disabled: boolean; busy: boolean };
  onCancel?: () => void;
  cancelDisabled?: boolean;
}) {
  return (
    <div className="border-border -mx-4 mt-3 flex shrink-0 flex-col gap-3 border-t px-4 pt-3">
      {strip ? <StepStrip at={strip} /> : null}
      {primary ? (
        <Button type="button" size="lg" className="min-h-12 w-full text-base font-semibold" disabled={primary.disabled} onClick={primary.onClick}>
          {primary.busy ? <Spinner size="sm" label="Working" /> : primary.label}
        </Button>
      ) : null}
      {onCancel ? (
        <button
          type="button"
          className="border-destructive/40 text-destructive hover:bg-destructive/5 h-11 self-center rounded-xl border bg-card px-5 text-sm font-semibold transition disabled:opacity-50"
          disabled={cancelDisabled}
          onClick={onCancel}
          data-guest-cancel-bill
        >
          Cancel bill
        </button>
      ) : null}
    </div>
  );
}
