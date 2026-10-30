import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      {children}
    </div>
  );
}

export function Section({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-8 first:mt-0", className)}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export function Stat({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <Card className={cn("p-4", strong && "border-primary/30 bg-brand-soft")}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </Card>
  );
}

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "dark";

const toneClass: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  brand: "border-primary/25 bg-brand-soft text-brand-text",
  success: "border-success/25 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  danger: "border-destructive/25 bg-destructive/5 text-destructive",
  dark: "border-foreground bg-foreground text-background",
};

export function Chip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A list in a card: rows separated by hairlines. */
export function List({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("divide-y divide-border overflow-hidden", className)}>{children}</Card>
  );
}

export function Row({
  href,
  title,
  sub,
  right,
  rightSub,
  leading,
}: {
  href?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  rightSub?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  const body = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {sub ? <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">{typeof sub === "string" ? <span className="truncate">{sub}</span> : sub}</div> : null}
      </div>
      {right !== undefined || rightSub !== undefined ? (
        <div className="shrink-0 text-right">
          <div className="tabular font-medium">{right}</div>
          {rightSub ? <div className="mt-0.5 text-xs text-muted-foreground">{rightSub}</div> : null}
        </div>
      ) : null}
      {href ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
    </>
  );
  const cls = "flex items-center gap-3 px-4 py-3";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-muted/60")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Avatar({ name, vip }: { name: string; vip?: boolean }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
        vip ? "bg-foreground text-background" : "bg-muted text-foreground",
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "outline",
  icon: Icon,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
  icon?: LucideIcon;
}) {
  return (
    <Link href={href} className={buttonClass(variant)}>
      {Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </Link>
  );
}

export function buttonClass(variant: "primary" | "outline" | "danger" = "outline") {
  return cn(
    "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    variant === "primary" && "bg-primary text-primary-foreground hover:bg-[var(--brand-pink-deep)]",
    variant === "outline" && "border border-border bg-card hover:bg-muted",
    variant === "danger" && "border border-destructive/30 bg-card text-destructive hover:bg-destructive/5",
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand-text">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="mt-3 font-semibold">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}

/** A label/value line for detail pages and summaries. */
export function Line({
  label,
  value,
  strong,
  muted,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-1.5 text-sm",
        strong && "border-t border-border pt-3 text-base font-semibold",
        muted && "text-muted-foreground",
      )}
    >
      <span>{label}</span>
      <span className="tabular text-right">{value}</span>
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm text-muted-foreground">{children}</p>;
}
