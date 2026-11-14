import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";
import { CARD_CLASS } from "./classes";
import { Skeleton as Bone } from "./ui/skeleton";
import { Chip } from "./chip";

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
      <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
      {label ?? "Loading…"}
    </div>
  );
}

/** Loading bones shaped like what will land: cards, or a table. */
export function Skeleton({
  variant = "cards",
  count = 2,
  className,
}: {
  variant?: "cards" | "table";
  count?: number;
  className?: string;
}) {
  if (variant === "table") {
    return (
      <div className={cn(CARD_CLASS, "flex flex-col gap-3", className)} aria-busy>
        <Bone className="h-4 w-40" />
        {Array.from({ length: 6 }, (_, i) => (
          <Bone key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-6 sm:gap-8", className)} aria-busy>
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
