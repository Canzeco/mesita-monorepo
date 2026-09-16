"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// The one piece of chrome the stepped flow adds (MESITA-1830, design review
// defect 6): a guest who has just come through phone + OTP has no idea whether
// this is the last gate or the third of six, and "Three answers. Takes about
// fifteen seconds." only says it once, on a screen they have already scrolled
// past. The dots say it continuously.
//
// THE DOTS ARE ONE CONTROL, NOT THREE. A screen reader gets a single
// `progressbar` reading "Step 2 of 3"; the individual spans are `aria-hidden`
// decoration. Three separately-announced dots would be noise in the middle of
// a question.
//
// THE RIGHT-HAND SPACER IS LOAD-BEARING. The back chevron only exists from
// step 2 on, so without a same-width box on the right the dot row would shift
// sideways between step 1 and step 2 — the one element on the screen whose job
// is to look stable.
export function OnboardStepBar({
  step,
  total,
  onBack,
}: {
  /** Zero-based. Back is not rendered at 0 — there is nothing before the
   *  first question inside the flow, and "Not you?" in the page footnote is
   *  the real exit. */
  step: number;
  total: number;
  onBack: () => void;
}) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div className="flex w-11 shrink-0 justify-start">
        {step > 0 ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="text-foreground hover:bg-muted -ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full transition"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
      </div>

      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step + 1}
        aria-label={`Step ${step + 1} of ${total}`}
        className="flex items-center gap-1.5"
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "h-1.5 rounded-full transition-all",
              i <= step ? "bg-foreground" : "bg-border",
              i === step ? "w-5" : "w-1.5",
            )}
          />
        ))}
      </div>

      <div className="w-11 shrink-0" />
    </div>
  );
}
