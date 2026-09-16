// SOON LIVES ON THE PAGE, never on the rail row.
//
// A dimmed row in the column would make the rail a place where some entries are
// real and some are not, and at `w-16` — chips only — a dim chip is
// indistinguishable from a disabled one. So every row is live, and the page it
// opens is where the product says it is not here yet.
//
// It deliberately does NOT take `shadow-card`: rank on this console comes from
// depth, which is what lets a strip and a Section share one type size.
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function SoonStrip({
  title,
  children,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-muted/40 flex items-start gap-3 rounded-2xl border border-dashed p-4",
        className,
      )}
    >
      <Clock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-display text-sm font-semibold tracking-tight">{title}</p>
        {children && (
          <div className="text-muted-foreground mt-1 text-[12px] leading-snug">{children}</div>
        )}
      </div>
    </div>
  );
}
