import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";
import { CARD_CLASS } from "./classes";
import { PAGE_BAND_CLASS, PageContainer } from "./layout";
import { Skeleton as Bone } from "./ui/skeleton";
import { Chip } from "./chip";

/** Content loading: bones, never a spinner (MESITA-4378). */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col gap-3 py-4" aria-busy aria-label={label ?? "Loading"}>
      <Bone className="h-4 w-40" />
      <Bone className="h-8 w-full" />
      <Bone className="h-8 w-full" />
      <Bone className="h-8 w-2/3" />
    </div>
  );
}

/** Loading bones shaped like what will land: cards, or a table. */
export function Skeleton({
  variant = "cards",
  count = 2,
  label,
  className,
}: {
  variant?: "cards" | "table";
  count?: number;
  /** Accessible name for what is loading. */
  label?: string;
  className?: string;
}) {
  if (variant === "table") {
    return (
      <div className={cn(CARD_CLASS, "flex flex-col gap-3", className)} aria-busy aria-label={label}>
        <Bone className="h-4 w-40" />
        {Array.from({ length: 6 }, (_, i) => (
          <Bone key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-6 sm:gap-8", className)} aria-busy aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn(CARD_CLASS, "flex flex-col gap-3")}>
          <Bone className="h-4 w-40" />
          <Bone className="h-3 w-64 max-w-full" />
          <Bone className="h-24 w-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * A whole page while it loads (MESITA-3261): the white band with title bones,
 * then bones shaped like the page's body. Without it the previous page stays
 * painted after a rail click.
 */
export function PageSkeleton({ variant = "cards" }: { variant?: "cards" | "table" }) {
  return (
    <PageContainer className="flex flex-col gap-6 sm:gap-8">
      <span className="sr-only" role="status">
        Loading
      </span>
      <div aria-hidden className={PAGE_BAND_CLASS}>
        <div className="flex flex-col gap-1.5">
          <Bone className="h-8 w-40" />
          <Bone className="h-4 w-72 max-w-full" />
        </div>
      </div>
      <Skeleton variant={variant} />
    </PageContainer>
  );
}

/** A list with zero rows says so in place, muted, with an optional action. */
export function EmptyState({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-muted-foreground flex flex-col items-start gap-3 py-6 text-sm", className)}>
      <p>{children}</p>
      {action}
    </div>
  );
}

// The empty state for a config page whose engine does not exist yet. The
// controls are DELETED from the markup, not hidden (Pato, 2026-08-21).
export function Soon({
  Icon,
  title,
  body,
  doc,
  footer,
}: {
  Icon: LucideIcon;
  title: string;
  body: string;
  doc: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
      <span className="bg-muted/60 text-muted-foreground flex h-11 w-11 items-center justify-center rounded-full">
        <Icon className="h-5 w-5" />
      </span>
      <p className="font-display text-foreground text-base font-semibold tracking-tight">{title}</p>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{body}</p>
      {footer}
      <Chip className="mt-1">Soon</Chip>
      <p className="text-muted-foreground/80 mt-1 type-label">{doc}</p>
    </div>
  );
}
