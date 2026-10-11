import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Shared empty state — closes the design-map debt note ("no shared
// EmptyState primitive yet"; web-consumer design map: Notion Docs › Design).
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
// NOT A CLIENT MODULE (MESITA-2129). It holds no state and no effect, and
// its `icon` prop is a component — a function, which React cannot serialise
// from a Server Component into a client one. With "use client" here, every
// server caller (Pay, the /web "Get the app" screen) died with digest
// 4172959490 and consumer.mesita.ai showed "This page couldn't load".
// Without it, EmptyState renders on whichever side imports it.
// `server-icon-props.test.ts` holds the rule for every component.
//
// No dashed decorative box: the design map's rule is "cards only when interactive", and
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
          <Button
            asChild
            className="shadow-glow mt-5 text-sm font-semibold active:scale-[0.98]"
          >
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button
            type="button"
            onClick={action.onClick}
            className="shadow-glow mt-5 text-sm font-semibold active:scale-[0.98]"
          >
            {action.label}
          </Button>
        ))}
    </div>
  );
}
