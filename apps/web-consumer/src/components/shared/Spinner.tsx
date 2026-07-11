import { cn } from "@/lib/utils";

// THE app spinner. Every in-flight surface — route transitions, client
// fetches, button pending states — renders this exact ring so loading reads
// as one deliberate brand gesture instead of a grab-bag of Loader2 sizes.
// Muted track + primary head keeps it visible on both bg-background and
// bg-card without per-surface tuning.

const SIZE = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
} as const;

export function Spinner({
  size = "md",
  label = "Loading",
  className,
}: {
  size?: keyof typeof SIZE;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "border-muted border-t-primary animate-spin rounded-full",
        SIZE[size],
        className,
      )}
    />
  );
}

// Fills whatever container it's given and centers the spinner in it.
// This is the ONLY correct body for a route-level loading.tsx that has no
// bespoke skeleton: it sizes to the layout band it lives in (shell body,
// tab region, modal panel) and never uses `fixed` — fixed escapes the
// MobileFrame card on desktop and flashes over the whole browser viewport.
export function LoadingFill({
  label = "Loading",
  size = "md",
  className,
}: {
  label?: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-1 items-center justify-center",
        className,
      )}
    >
      <Spinner size={size} label={label} />
    </div>
  );
}
