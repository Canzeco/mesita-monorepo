"use client";

import { PIPELINE_STEPS } from "./pipeline";

// Sticks to the top of the page so no surface can scroll off and leave
// another looking like the whole tool.
//
// top-0, NOT top-14: the mobile topbar is a sibling of the scrolling <main>,
// not a row inside it, so `main`'s top already sits under the hamburger. The
// 3.5rem offset it used to carry was measured against the window and opened a
// 56px strip of bare background above the chips on every phone.

export function PipelineNav() {
  return (
    <nav
      aria-label="Google Search, Mesita Search, Mesita Intake"
      className="border-border bg-background/90 sticky top-0 z-20 -mx-1 mb-4 border-b px-1 py-2 backdrop-blur"
    >
      <ol className="flex flex-wrap gap-2">
        {PIPELINE_STEPS.map((step) => (
          <li key={step.id}>
            <a
              href={`#${step.id}`}
              className="border-border bg-card hover:border-foreground/40 inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
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
