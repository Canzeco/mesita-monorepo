// Shared empty-state card — dashed-border tile with an icon-circle on top,
// a title, optional description, and an optional CTA. Replaces the
// hand-rolled "No venue yet / No businesses yet" patterns that used to live
// inline on each page.

import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-card flex flex-col items-center rounded-2xl border border-dashed p-10 text-center",
        className,
      )}
    >
      <div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
        {icon}
      </div>
      <h2 className="font-display text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {description && (
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
