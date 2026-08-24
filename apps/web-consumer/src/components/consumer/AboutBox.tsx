"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Expandable About card. English only (Mesita core). Spanish TMS is later
// (MESITA-939) — do not show a second language here.
//
// Short stories render in full — no toggle, no ellipsis. Only when the
// description is extremely long (over ~600 characters, ≈ 10 mobile lines)
// do we clamp to line-clamp-10 with a "Show more" toggle.
//
// Intaker Abouts are multi-paragraph (blank-line separated). Normalize
// to \n\n and render with whitespace-pre-wrap so paragraphs show and
// line-clamp still works on one block.

const LONG_TEXT_THRESHOLD = 600;

function formatAboutDisplay(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const blankSplit = normalized
    .split(/\n\s*\n+/)
    .map((p) =>
      p
        .replace(/\n+/g, " ")
        .replace(/[ \t]+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  if (blankSplit.length > 1) return blankSplit.join("\n\n");
  const soft = normalized
    .split(/\n+/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  return soft.length > 1 ? soft.join("\n\n") : normalized;
}

export function AboutBox({ text, name }: { text: string; name: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > LONG_TEXT_THRESHOLD;
  // Include the place name so this header reads as "about the place", not
  // "about the reward" sitting directly above it.
  const heading = `About ${name}`;
  const body = formatAboutDisplay(text);

  if (!isLong) {
    return (
      <section className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
        <h3 className="text-muted-foreground type-meta font-bold tracking-[0.14em] uppercase">
          {heading}
        </h3>
        <p className="text-muted-foreground text-base leading-relaxed whitespace-pre-wrap">
          {body}
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
      <h3 className="text-muted-foreground type-meta font-bold tracking-[0.14em] uppercase">
        {heading}
      </h3>
      <p
        className={cn(
          "text-muted-foreground text-base leading-relaxed whitespace-pre-wrap",
          !expanded && "line-clamp-10",
        )}
      >
        {body}
      </p>
      <span className="text-foreground type-label inline-flex items-center gap-1 font-semibold">
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
