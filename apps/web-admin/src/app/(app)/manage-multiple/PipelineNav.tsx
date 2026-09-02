"use client";

import { PIPELINE_STEPS } from "./pipeline";

// Sticks to the top of the page so no surface can scroll off and leave
// another looking like the whole tool.
//
// top-0, NOT top-14: the mobile topbar is a sibling of the scrolling <main>,
// not a row inside it, so `main`'s top already sits under the hamburger. The
// 3.5rem offset it used to carry was measured against the window and opened a
// 56px strip of bare background above the chips on every phone.
//
// OPAQUE, and it spans the column. `bg-background/90` is the page colour at
// 90% over white cards: it read as a gap in the card rather than as a bar,
// and backdrop-blur is not opacity — the card's own headings ghosted through
// the chips as you scrolled under them. A solid fill plus the gutter bleed
// makes it chrome.
//
// ONE ROW that scrolls, not a wrapped block. Three chips need ~445px, so on a
// phone they wrapped to two lines and this bar — which is sticky, so the cost
// is permanent — held about 90px of a ~700px viewport. They fit one line from
// `sm` up, where the wrap never happened anyway.

export function PipelineNav() {
  return (
    <nav
      aria-label="Google Search, Mesita Search, Mesita Intake"
      className="border-border bg-background sticky top-0 z-20 -mx-4 mb-4 border-b px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <ol className="flex gap-2 overflow-x-auto scrollbar-none sm:flex-wrap sm:overflow-x-visible">
        {PIPELINE_STEPS.map((step) => (
          <li key={step.id} className="shrink-0">
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
