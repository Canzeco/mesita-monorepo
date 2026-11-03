// A page's title block and body column (MESITA-3103).

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {sub ? (
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            {sub}
          </p>
        ) : null}
      </div>
      {right}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // cn, so a card of rows' `p-0 sm:p-0` really is flush (MESITA-3177).
  return (
    <section
      className={cn(
        "border-border bg-card rounded-2xl border p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}
