import type { ReactNode } from "react";
import { PAY_STEPS, type PayStepKey, payStepLabel, payStepNumber, payStepSpoken, SIGN } from "@mesita/place-profile/lib/pay-steps";
import { cn } from "@/lib/utils";

// THE PAY STRIP (MESITA-3759): the six named steps, drawn the same on the
// place page (steps 2 to 5) and on the guest's payment page (step 6).
//
//   [photo] Place name (truncates) ............ 2 · Bill   <- the page's h2
//   ━━━━ ▭▭▭▭ ──── ──── ──── ────                          <- done · current · later
//
// Done steps are solid ink, the current step is a hollow outline, later
// steps are muted: so all six solid means the waiter signed and nothing
// else, and the label then reads "Signed" with no number. The label is the
// page's only heading; it never wraps or truncates (the place name does).
// The segments are not tappable (Back is the one way back) and are hidden
// from screen readers, which hear one label, "Step 2 of 6: Bill".

export function PaySteps({
  step,
  signed = false,
  left,
  className,
}: {
  step: PayStepKey;
  /** The waiter signed: all six solid, the label reads "Signed". */
  signed?: boolean;
  /** Row one's left side: what the screen already shows (photo and name). */
  left: ReactNode;
  className?: string;
}) {
  const current = payStepNumber(step) - 1;
  return (
    <div className={cn("shrink-0", className)} data-pay-steps={signed ? "signed" : step}>
      <div className="flex h-9 items-center gap-2.5">
        {left}
        <h2 className="shrink-0 text-base font-semibold whitespace-nowrap" aria-label={signed ? SIGN.signed : payStepSpoken(step)}>
          {signed ? SIGN.signed : payStepLabel(step, "guest")}
        </h2>
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden>
        {PAY_STEPS.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              signed || i < current ? "bg-foreground" : i === current ? "border-foreground border" : "bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}
