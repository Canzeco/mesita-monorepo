import type { ReactNode } from "react";
import { PAY_STEPS, type PayStepKey, payStepLabel, payStepName, payStepNumber, payStepSpoken, SIGN } from "@mesita/place-profile/lib/pay-steps";
import { cn } from "@/lib/utils";

// THE PAY STRIP (MESITA-3759): the seven named steps (MESITA-3776 added
// Ticket), drawn the same on the place page (steps 2 to 6) and on the
// guest's payment page (step 7).
//
//   [photo] Place name (truncates) ............ 3 · Bill   <- the page's h2
//   ━━━━ ━━━━ ▭▭▭▭ ──── ──── ──── ────                     <- done · current · later
//
// Done steps are solid ink, the current step is a hollow outline, later
// steps are muted: so all seven solid means the waiter signed and nothing
// else, and the label then reads "Signed" with no number. The label is the
// page's only heading; it never wraps or truncates (the place name does),
// and at 375px the seven segments shrink, never the label. Screen readers
// hear one label, "Step 3 of 7: Bill". With `onStep` (the guest's payment
// page, MESITA-3772) the steps already walked can be opened again:
// segments 2 to `reached` (never step 1, Pick) are buttons, each named
// "Show step 4: Tip". `canOpen` narrows which: the place page opens only
// "2 · Ticket" from a later step (MESITA-3776); Back is its way back.

export function PaySteps({
  step,
  signed = false,
  left,
  className,
  onStep,
  reached = "sign",
  canOpen,
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
  /** With `onStep`: which of those steps are buttons (default: all). */
  canOpen?: (key: PayStepKey) => boolean;
}) {
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
      {onStep ? (
        // Each segment's tap target is its share of the row, 28px tall.
        <div className="mt-1 flex gap-1.5" role="group" aria-label="Payment steps">
          {PAY_STEPS.map((s, i) =>
            i >= 1 && i <= last && i !== current && (canOpen?.(s.key) ?? true) ? (
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
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {PAY_STEPS.map((s, i) => (
            <span key={s.key} className={bar(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
