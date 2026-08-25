"use client";

import { PIPELINE_STEPS } from "./pipeline";

// Sticks under the mobile hamburger (and at the top on desktop) so Search
// cannot scroll off and leave Create looking like the whole tool.

export function PipelineNav() {
  return (
    <nav
      aria-label="Search, Create, Enrich"
      className="border-border bg-background/90 sticky top-14 z-20 -mx-1 mb-4 border-b px-1 py-2 backdrop-blur lg:top-0"
    >
      <ol className="flex flex-wrap gap-2">
        {PIPELINE_STEPS.map((step) => (
          <li key={step.id}>
            <a
              href={`#${step.id}`}
              className="border-border bg-card hover:border-foreground/40 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
            >
              <span
                aria-hidden
                className="bg-primary/10 text-primary type-label inline-flex h-5 w-5 items-center justify-center rounded-full font-semibold tabular-nums"
              >
                {step.n}
              </span>
              {step.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
