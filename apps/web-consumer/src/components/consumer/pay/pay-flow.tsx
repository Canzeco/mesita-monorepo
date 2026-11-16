"use client";

import { createContext, useContext, useEffect } from "react";
import { SizedImg } from "@mesita/place-profile";
import { ChevronLeft, ChevronRight, CreditCard, HandCoins, Lock, MapPin, PenLine, ReceiptText, Store, Wallet, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PayPlace } from "@/lib/api/wallet";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/shared/Panel";
import { Spinner } from "@/components/shared/Spinner";
import { goBack } from "@/lib/navigate";
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
  expired: "An hour passed without a signature.",
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
        <span className="font-display max-w-full truncate text-xl font-semibold">{place.name ?? "A Mesita place"}</span>
        <span className="flex items-center gap-1 text-sm text-white/85">
          <MapPin className="h-4 w-4" aria-hidden />
          {place.distance_m !== null ? distanceText(place.distance_m) : "Tap to choose another place"}
        </span>
      </button>
    </div>
  );
}

/** The top of every step, Bill to Sign (MESITA-4061: the keypad step too):
 *  the place's photo and name. With `onChoose` the name is a button (a grey
 *  chevron says so) to choose another place, keeping the draft; Sign's is
 *  plain. Cancel bill is the footer's (MESITA-4051). */
export function PlaceBar({ place, name, onChoose }: { place: PayPlace | null; name?: string | null; onChoose?: () => void }) {
  const label = place?.name ?? name ?? "A Mesita place";
  const row = (
    <>
      <span className="bg-muted h-9 w-9 shrink-0 overflow-hidden rounded-full" aria-hidden>
        {place?.photo ? <SizedImg src={place.photo} size="thumb" alt="" className="h-full w-full object-cover" /> : null}
      </span>
      <span className="min-w-0 truncate text-base font-semibold">{label}</span>
      {onChoose ? <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden /> : null}
    </>
  );
  return onChoose ? (
    <button type="button" onClick={onChoose} className="flex h-11 min-w-0 shrink-0 items-center gap-3 self-start text-left" aria-label={`${label}. Choose another place`}>
      {row}
    </button>
  ) : (
    <div className="flex h-11 shrink-0 items-center gap-3">{row}</div>
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

/** The seven steps (MESITA-4117, Pato: "THE PAYMENT FLOW MUST HAVE 7 STEPS,
 *  ONE HIDDEN OPTIONAL: Pick, Bill, Tip, Method, Card, Pay, Sign"; five until
 *  then, MESITA-3878). Pick is the Pay tab's list of places, done on every
 *  later step; Card is skipped for cash, Card and
 *  Pay when credits cover everything (lib/guest-pay-stages.ts). */
export const PAY_FLOW_STEPS = ["Pick", "Bill", "Tip", "Method", "Card", "Pay", "Sign"] as const;

/** Each step's icon beside its name in the step nav (MESITA-4125, Pato:
 *  "use icons in the current steps for more clarity"). */
const PAY_STEP_ICONS: Record<(typeof PAY_FLOW_STEPS)[number], LucideIcon> = {
  Pick: Store,
  Bill: ReceiptText,
  Tip: HandCoins,
  Method: Wallet,
  Card: CreditCard,
  Pay: Lock,
  Sign: PenLine,
};

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

/** The step nav (MESITA-4061, Pato: "steps with arrows to nav across them
 *  < >"): ‹ one step back, "Tip · 3 of 7", › the footer's Next. An arrow
 *  that cannot act is hidden (its 44px slot kept, gone from the screen
 *  reader); › exists only where the footer's button is a plain Next, never
 *  where it moves money or leaves the app. Under it, seven thin segments
 *  (MESITA-4117), done and current ink, skipped ones dashed. A pure view:
 *  the screen owns the back logic. */
export function StepNav({
  at,
  onBack,
  next,
  skipped = [],
}: {
  at: number;
  onBack?: () => void;
  next?: { onClick: () => void; disabled: boolean };
  /** Steps this payment skips: a dashed segment, and the arrows' labels
   *  name the step they really reach (MESITA-4117). */
  skipped?: readonly number[];
}) {
  const name = PAY_FLOW_STEPS[at];
  const StepIcon = PAY_STEP_ICONS[name];
  // The neighbours an arrow really reaches, past skipped steps.
  let prev = at - 1;
  while (prev > 0 && skipped.includes(prev)) prev -= 1;
  let following = at + 1;
  while (following < PAY_FLOW_STEPS.length - 1 && skipped.includes(following)) following += 1;
  const backLabel = prev <= 0 ? "Back to places" : `Back to ${PAY_FLOW_STEPS[prev]}`;
  const arrow = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    // MESITA-4072 (Pato: "this payment workflow, all steps, maybe in boxes
    // too"): the step nav is the bottom half of the top panel (PayTop), under
    // a hairline from the place. MESITA-4068 drew it between two inset
    // hairlines on the page.
    <div className="border-border border-t px-2 py-2" data-pay-steps>
      <div className="flex h-11 items-center">
        <button
          type="button"
          onClick={onBack}
          className={cn(arrow, !onBack && "invisible")}
          aria-label={backLabel}
          tabIndex={onBack ? undefined : -1}
          data-pay-back
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <p className="flex min-w-0 flex-1 items-center justify-center gap-1.5 truncate text-base">
          <StepIcon className="h-5 w-5 shrink-0" aria-hidden />
          <span className="font-semibold">{name}</span>
          <span className="text-muted-foreground">{` · ${at + 1} of ${PAY_FLOW_STEPS.length}`}</span>
        </p>
        <button
          type="button"
          onClick={next?.onClick}
          disabled={next?.disabled}
          className={cn(arrow, !next && "invisible")}
          aria-label={following < PAY_FLOW_STEPS.length ? `Next: ${PAY_FLOW_STEPS[following]}` : "Next"}
          tabIndex={next ? undefined : -1}
          data-pay-next
        >
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>
      </div>
      {/* Segments only, one text line above (MESITA-4117): done and current
          ink, not yet grey, skipped a dashed hairline on nothing. */}
      <ol className="mt-1 grid grid-cols-7 gap-1.5" aria-label={`Step ${at + 1} of ${PAY_FLOW_STEPS.length}: ${name}`}>
        {PAY_FLOW_STEPS.map((step, i) => (
          <li
            key={step}
            aria-current={i === at ? "step" : undefined}
            className={cn(
              "h-1 rounded-full",
              skipped.includes(i) && i !== at ? "border-border border border-dashed bg-transparent" : i <= at ? "bg-foreground" : "bg-border",
            )}
          />
        ))}
      </ol>
    </div>
  );
}

/** THE TOP PANEL (MESITA-4072): the place and, on a step, the step nav,
 *  one shared Panel across the top of every guest Pay screen. */
/** The place a bill is at, for the page header (MESITA-4122). */
export type PayHeaderPlace = { name: string; photo: string | null };

/** Set by the bill's page (PayTabScreen): a step hands it its place, and the
 *  header reads "Pay at [photo] Name" (MESITA-4122, Pato: "move the place
 *  name and pp to the header ... steps directly. Optimize vertical space").
 *  Absent, the place keeps its own row in the top panel. */
export const PayHeaderPlaceContext = createContext<((p: PayHeaderPlace | null) => void) | null>(null);

export function PayTop({
  place,
  name,
  onChoose,
  step,
}: {
  place: PayPlace | null;
  name?: string | null;
  onChoose?: () => void;
  step?: { at: number; onBack?: () => void; next?: { onClick: () => void; disabled: boolean }; skipped?: readonly number[] };
}) {
  const setHeader = useContext(PayHeaderPlaceContext);
  const label = place?.name ?? name ?? null;
  const photo = place?.photo ?? null;
  useEffect(() => {
    setHeader?.(label ? { name: label, photo } : null);
  }, [setHeader, label, photo]);
  // The header names the place: the panel is the steps alone.
  if (setHeader) {
    return step ? (
      <Panel className="shrink-0" data-pay-top>
        <StepNav at={step.at} onBack={step.onBack} next={step.next} />
      </Panel>
    ) : null;
  }
  return (
    <Panel className="shrink-0" data-pay-top>
      <div className="flex px-4 py-1.5">
        <PlaceBar place={place} name={name} onChoose={onChoose} />
      </div>
      {step ? <StepNav at={step.at} onBack={step.onBack} next={step.next} skipped={step.skipped} /> : null}
    </Panel>
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

/** The bottom row, pinned under a full-width hairline: the red Cancel bill
 *  (MESITA-4051) a quarter, the step's one dark button three quarters
 *  (MESITA-4058, Pato: "maybe 25% and 75% for black button"). With no
 *  primary (Sign: the waiter acts, not the guest) Cancel bill fills the row. */
export function StepFooter({
  primary,
  onCancel,
  cancelDisabled,
}: {
  primary?: { label: React.ReactNode; onClick: () => void; disabled: boolean; busy: boolean };
  onCancel: () => void;
  cancelDisabled: boolean;
}) {
  // NO PRIMARY, SMALL CANCEL (MESITA-4126, Pato: "make the red button
  // smaller ... that looks like close the bill, not like cancel it"): while
  // the guest waits for the waiter (Sign) Cancel bill is a small centred
  // outlined red button, never the full-width red bar.
  if (!primary) {
    return (
      <div className="border-border -mx-4 mt-3 flex shrink-0 justify-center border-t px-4 pt-3">
        <button
          type="button"
          className="border-destructive/40 text-destructive hover:bg-destructive/5 h-11 rounded-xl border bg-card px-5 text-sm font-semibold transition disabled:opacity-50"
          disabled={cancelDisabled}
          onClick={onCancel}
          data-guest-cancel-bill
        >
          Cancel bill
        </button>
      </div>
    );
  }
  return (
    <div className={cn("border-border -mx-4 mt-3 grid shrink-0 gap-3 border-t px-4 pt-3", primary && "grid-cols-[1fr_3fr]")}>
      <Button
        type="button"
        size="lg"
        variant="danger"
        className="min-h-12 w-full px-1 text-sm leading-tight font-semibold whitespace-normal"
        disabled={cancelDisabled}
        onClick={onCancel}
        data-guest-cancel-bill
      >
        Cancel bill
      </Button>
      {primary ? (
        <Button type="button" size="lg" className="min-h-12 w-full text-base font-semibold" disabled={primary.disabled} onClick={primary.onClick}>
          {primary.busy ? <Spinner size="sm" label="Working" /> : primary.label}
        </Button>
      ) : null}
    </div>
  );
}
