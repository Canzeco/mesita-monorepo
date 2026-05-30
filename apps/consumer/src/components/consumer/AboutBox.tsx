"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Expandable About card. Short stories render in full — no toggle, no
// ellipsis. Only when the description is extremely long (over ~600
// characters, ≈ 10 mobile lines) do we clamp to line-clamp-10 with a
// "Show more" toggle. The whole card is the toggle target so taps
// anywhere on it open it up.

const LONG_TEXT_THRESHOLD = 600;

export function AboutBox({ text, name }: { text: string; name: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > LONG_TEXT_THRESHOLD;
  // Include the venue name so this header reads as "about the place", not
  // "about the reward" sitting directly above it.
  const heading = `About ${name}`;

  if (!isLong) {
    return (
      <section className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
        <h3 className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
          {heading}
        </h3>
        <p className="text-muted-foreground text-base leading-relaxed">
          {text}
        </p>
      </section>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setExpanded((e) => !e)}
      aria-expanded={expanded}
      className="border-border bg-card hover:bg-card/80 flex flex-col gap-3 rounded-2xl border p-4 text-left transition"
    >
      <h3 className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
        {heading}
      </h3>
      <p
        className={cn(
          "text-muted-foreground text-base leading-relaxed",
          !expanded && "line-clamp-10",
        )}
      >
        {text}
      </p>
      <span className="text-foreground inline-flex items-center gap-1 text-[11px] font-semibold">
        {expanded ? "Show less" : "Show more"}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </span>
    </button>
  );
}
