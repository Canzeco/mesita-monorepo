"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Expandable About card. Renders the long story collapsed to 3 lines
// with a fade-into-ellipsis (line-clamp-3); the whole card is the
// toggle so taps anywhere on it open it up to full height. Lives
// outside VenueDetailBody so the server component can stay server.

export function AboutBox({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setExpanded((e) => !e)}
      aria-expanded={expanded}
      className="border-border bg-card hover:bg-card/80 flex flex-col gap-3 rounded-2xl border p-4 text-left transition"
    >
      <h3 className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
        About
      </h3>
      <p
        className={cn(
          "text-muted-foreground text-sm leading-relaxed",
          !expanded && "line-clamp-3",
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
