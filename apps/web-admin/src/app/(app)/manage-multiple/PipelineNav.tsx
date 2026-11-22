"use client";

import { JUMP_BAR_CLASS, JUMP_CHIP_CLASS, JUMP_CHIP_NUMBER_CLASS } from "@/components/admin-ui/classes";
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
// ONE ROW that scrolls, not a wrapped block. Wrapped, the chips took two
// lines on a phone and this bar — which is sticky, so the cost is permanent —
// held about 90px of a ~700px viewport. The five chips scroll sideways on a
// phone and wrap only from `sm` up.

export function PipelineNav() {
  return (
    <nav
      aria-label={PIPELINE_STEPS.map((step) => step.label).join(", ")}
      className={`${JUMP_BAR_CLASS} z-20`}
    >
      <ol className="flex gap-2 overflow-x-auto scrollbar-none sm:flex-wrap sm:overflow-x-visible">
        {PIPELINE_STEPS.map((step) => (
          <li key={step.id} className="shrink-0">
            <a
              href={`#${step.id}`}
              className={JUMP_CHIP_CLASS}
            >
              <span aria-hidden className={JUMP_CHIP_NUMBER_CLASS}>
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
