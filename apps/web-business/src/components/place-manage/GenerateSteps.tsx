"use client";

// The create steps (MESITA-3140), the consumer app's Generate line
// (web-consumer GeneratingPlace, MESITA-2935): a new place takes about ten
// seconds, measured (6.6–12.9 s), so the line names the step the create is
// on. The steps are the create run's own (_shared/create-place.ts) and
// advance on a timer, never past the last.

import { useEffect, useState } from "react";

const STEPS = [
  { at: 0, label: "Reading Google's listing" },
  { at: 3000, label: "Writing its profile" },
  { at: 8000, label: "Almost ready" },
] as const;

export function GenerateSteps() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = STEPS.slice(1).map((s, i) => window.setTimeout(() => setStep(i + 1), s.at));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);
  return (
    <span role="status" className="flex flex-col items-center text-center">
      <span key={step} className="text-sm font-semibold">
        {STEPS[step].label}…
      </span>
      <span className="text-muted-foreground mt-0.5 text-xs">About 10 seconds</span>
    </span>
  );
}

/** "Enriching" (MESITA-3140): Mesita is filling in the profile from public
 *  sources (content_state generating), as the consumer profile shows it. */
export function EnrichingTag() {
  return (
    <span className="border-border bg-card type-label inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold">
      <span className="size-1.5 animate-pulse rounded-full bg-amber-500 motion-reduce:animate-none" aria-hidden />
      Enriching
    </span>
  );
}
