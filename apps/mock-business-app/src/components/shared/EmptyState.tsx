// An empty list, and the one law it obeys: A FETCH FAILURE NEVER SAYS "ADD ONE".
//
// `kind` is the whole component. "empty" is a successful read of nothing and
// may invite the operator to create something; "failed" is a read that did not
// happen, and the only honest verb on it is Retry. Collapsing the two is how a
// console tells a restaurant it has no places on the morning its API is down.
import { AlertTriangle, Inbox } from "lucide-react";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export function EmptyState({
  kind = "empty",
  title,
  hint,
  action,
  className,
}: {
  kind?: "empty" | "failed";
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void } | null;
  className?: string;
}) {
  const failed = kind === "failed";
  const Icon = failed ? AlertTriangle : Inbox;
  return (
    <div
      role={failed ? "alert" : undefined}
      className={cn(
        "border-border flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <Icon
        className={cn("h-5 w-5", failed ? "text-destructive" : "text-muted-foreground")}
        aria-hidden
      />
      <p className="text-sm font-semibold">{title}</p>
      {hint && (
        <p className="text-muted-foreground max-w-prose text-[12px] leading-snug">
          {hint}
        </p>
      )}
      {action && (
        <button type="button" onClick={action.onClick} className={cn(CTA_BUTTON_CLASS, "mt-2")}>
          {action.label}
        </button>
      )}
    </div>
  );
}
