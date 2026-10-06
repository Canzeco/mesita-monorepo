// SOON LIVES ON THE PAGE, never on the rail row.
//
// A dimmed row in the column would make the rail a place where some entries are
// real and some are not — and the rail has no second vocabulary to say which is
// which. So every row is live, and the page it opens is where the product says
// it is not here yet.
//
// It ranks BELOW a Section, and since MESITA-1934 it does that with a DASHED
// hairline and no fill at all, not with depth. The console used to rank by
// shadow; the achromatic palette removed every shadow but the two that really
// float, so the mechanism had to move. Dashed already means "not here yet" in
// this app — EmptyState uses the same border — so the strip and a Section can
// still share one type size and read as different ranks.
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
        "border-border flex items-start gap-3 rounded-2xl border border-dashed p-4",
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
