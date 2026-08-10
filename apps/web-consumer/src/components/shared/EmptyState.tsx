"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared empty state — closes the DESIGN.md §10 debt note ("no shared
// EmptyState primitive yet").
//
// Two rules the old ad-hoc versions kept getting wrong:
//
//  1. It CENTRES in the space it's given (`flex-1` + `justify-center`), rather
//     than pinning to the top of a tall container. A box floating at the top of
//     700px of nothing reads as a screen that failed to load, not as a calm
//     zero state.
//  2. It carries an ACTION. "Swipe right on a place to save it" tells you what
//     to do without giving you a way to do it — the reader has to go find the
//     tab themselves. An empty state without a next step is a dead end.
//
// No dashed decorative box: DESIGN.md §2 is "cards only when interactive", and
// a zero state isn't. Tinted icon circle + display title + muted copy + one CTA
// is the whole vocabulary.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Primary next step. Omit only when there genuinely isn't one. */
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-10 text-center",
        className,
      )}
    >
      <span className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-2xl">
        <Icon className="h-7 w-7" strokeWidth={2} />
      </span>
      <h3 className="font-display mt-4 text-lg font-semibold tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-muted-foreground mt-1.5 max-w-[30ch] text-sm leading-relaxed">
          {description}
        </p>
      )}
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className="bg-pink-gradient shadow-glow mt-5 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="bg-pink-gradient shadow-glow mt-5 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
