"use client";

import type React from "react";

import { cn } from "../../lib/format";

// One flat section of the place scroll (MESITA-2441): a hairline above, a
// title, then the content. No card, no box — the OpenTable/Resy page is one
// white sheet divided by lines.
export function Section({
  title,
  right,
  children,
  className,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn("border-border flex flex-col gap-3 border-t px-4 py-5", className)}
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {right ? (
          <span className="text-muted-foreground type-label min-w-0 shrink truncate text-right">
            {right}
          </span>
        ) : null}
      </header>
      {children}
    </section>
  );
}
