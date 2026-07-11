import { cn } from "@/lib/utils";

/** Bordered field group — no section title, used to cluster KV rows on Basics. */
export function PlaceBox({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border/50 flex flex-col gap-3 rounded-2xl border bg-card/40 px-4 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
