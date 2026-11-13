import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAY_STEPS, type PayStepKey, payStepLabel, payStepName, payStepNumber, payStepSpoken, SIGN } from "@mesita/place-profile/lib/pay-steps";
import { cn } from "@/lib/utils";

// THE PAY STRIP (MESITA-3759): the seven named steps (MESITA-3798), drawn
// the same on the place page (steps 2 to 6) and on the guest's payment page
// (step 7).
//
//   [photo] Place name (truncates) ............ 2 · Bill   <- the page's h2
//   ━━━━ ▭▭▭▭ ──── ──── ──── ──── ────                     <- done · current · later
//
// Done steps are solid ink, the current step is a hollow outline, later
// steps are muted: so all seven solid means the waiter signed and nothing
// else, and the label then reads "Signed" with no number. The label is the
// page's only heading; it never wraps or truncates (the place name does).
// On the place page the segments are not tappable (Back is the one way
// back) and are hidden from screen readers, which hear one label, "Step 2 of
// 7: Bill". On the guest's payment page (MESITA-3772) the steps already
// walked can be opened again: with `onStep`, segments 2 to `reached` (never
// step 1, Pick) are buttons, each named "Show step 3: Tip".
//
// BABY ARROWS (Pato, 2026-11-13, MESITA-3825: "the top arrow must be to close
// the ticket, not to return from step to step. for the steps, add baby
// arrows near the steps bar"): with `onPrev`/`onNext` passed, a small ‹ sits
// before the bar and › after it; null greys one out. The header's arrow
// closes the screen instead.

export function PaySteps({
  step,
  signed = false,
  left,
  className,
  onStep,
  reached = "sign",
  onPrev,
  onNext,
}: {
  /** The step shown (the current segment and the heading). */
  step: PayStepKey;
  /** The waiter signed: all seven solid; at step 7 the label reads "Signed". */
  signed?: boolean;
  /** Row one's left side: what the screen already shows (photo and name). */
  left: ReactNode;
  className?: string;
  /** Opens a step already walked; without it no segment is focusable. */
  onStep?: (key: PayStepKey) => void;
  /** With `onStep`: the furthest step the payment reached (it can be opened). */
  reached?: PayStepKey;
  /** The ‹ beside the bar: one step back; null draws it disabled. Omitted with `onNext`: no arrows. */
  onPrev?: (() => void) | null;
  /** The › beside the bar: one step on; null draws it disabled. */
  onNext?: (() => void) | null;
}) {
  const arrows = onPrev !== undefined || onNext !== undefined;
  const arrow = (dir: "prev" | "next", go: (() => void) | null | undefined) => {
    const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
    return (
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground -my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition disabled:opacity-30"
        aria-label={dir === "prev" ? "Previous step" : "Next step"}
        disabled={!go}
        onClick={() => go?.()}
        data-pay-step-arrow={dir}
      >
        <Icon className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </button>
    );
  };
  const current = payStepNumber(step) - 1;
  const last = payStepNumber(reached) - 1;
  const signedLabel = signed && step === "sign";
  const bar = (i: number) =>
    cn("h-1.5 flex-1 rounded-full", signed || i < current ? "bg-foreground" : i === current ? "border-foreground border" : "bg-border");
  return (
    <div className={cn("shrink-0", className)} data-pay-steps={signedLabel ? "signed" : step}>
      <div className="flex h-9 items-center gap-2.5">
        {left}
        <h2 className="shrink-0 text-base font-semibold whitespace-nowrap" aria-label={signedLabel ? SIGN.signed : payStepSpoken(step)}>
          {signedLabel ? SIGN.signed : payStepLabel(step, "guest")}
        </h2>
      </div>
      <div className={cn("flex items-center", arrows && "mt-1 gap-1")}>
      {arrows ? arrow("prev", onPrev) : null}
      {onStep ? (
        // Each segment's tap target is its share of the row, 28px tall.
        <div className={cn("flex min-w-0 flex-1 gap-1.5", !arrows && "mt-1")} role="group" aria-label="Payment steps">
          {PAY_STEPS.map((s, i) =>
            i >= 1 && i <= last && i !== current ? (
              <button
                key={s.key}
                type="button"
                className="flex flex-1 py-2"
                aria-label={`Show step ${i + 1}: ${payStepName(s.key, "guest")}`}
                onClick={() => onStep(s.key)}
              >
                <span className={bar(i)} />
              </button>
            ) : (
              <span key={s.key} className="flex flex-1 py-2" aria-hidden>
                <span className={bar(i)} />
              </span>
            ),
          )}
        </div>
      ) : (
        <div className={cn("flex min-w-0 flex-1 gap-1.5", !arrows && "mt-3")} aria-hidden>
          {PAY_STEPS.map((s, i) => (
            <span key={s.key} className={bar(i)} />
          ))}
        </div>
      )}
      {arrows ? arrow("next", onNext) : null}
      </div>
    </div>
  );
}
