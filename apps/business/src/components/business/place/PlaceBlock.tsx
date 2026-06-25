import { cn } from "@/lib/utils";

/** Flat content wrapper — no card chrome; section titles live in the nav. */
export function PlaceBlock({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {title ? <h3 className="sr-only">{title}</h3> : null}
      {children}
    </div>
  );
}
