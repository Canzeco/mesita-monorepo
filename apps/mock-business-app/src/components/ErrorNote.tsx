// AN ERROR SAYS WHAT, WHY, AND WHAT TO DO (MESITA-2017).
//
// It took one string until this issue, and one string cannot carry a next
// step: "Stripe paused this account" is a fact the operator can do nothing
// with, and "Reconnect Uber Eats" is a verb that needs somewhere to go. So
// `cause` is the second sentence and `action` is the one door. Both are
// optional because some errors have no door — "back on Monday" has nothing to
// click — and a greyed button where the truth is "wait" is the wrong shape.
//
// ONE ACTION, BY TYPE. `action` is a single object, not a list: a state with
// two ways out has not decided, and the type refuses to let it not decide.
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export type ErrorAction = { label: string; href: string };

export function ErrorNote({
  message,
  cause,
  action,
  className,
}: {
  message: string;
  cause?: string;
  action?: ErrorAction;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "border-destructive/40 bg-destructive/5 text-destructive mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="font-medium">{message}</p>
        {cause && <p className="text-destructive/80 leading-snug">{cause}</p>}
        {action && (
          <Link href={action.href} className={cn(GHOST_PILL_BUTTON_CLASS, "self-start")}>
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}
