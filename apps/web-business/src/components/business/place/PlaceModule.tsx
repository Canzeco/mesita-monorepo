import { cn } from "@/lib/utils";
import type { PlaceSectionId } from "./place-sections";
import {
  placeSectionDescription,
  placeSectionDomId,
  placeSectionLabel,
} from "./place-sections";

export function PlaceModule({
  id,
  title,
  description,
  hideHeader = false,
  children,
  className,
  contentClassName,
}: {
  id: PlaceSectionId;
  title?: string;
  description?: string;
  hideHeader?: boolean;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const heading = title ?? placeSectionLabel(id);
  const blurb = description ?? placeSectionDescription(id);
  const headingId = `${placeSectionDomId(id)}-heading`;

  if (hideHeader) {
    return (
      <section
        id={placeSectionDomId(id)}
        className={cn("relative z-0", className)}
      >
        <div className={cn("flex flex-col gap-3", contentClassName)}>
          {children}
        </div>
      </section>
    );
  }

  return (
    <section
      id={placeSectionDomId(id)}
      aria-labelledby={headingId}
      className={cn("relative z-0", className)}
    >
      <div className="border-border/50 flex flex-col gap-4 rounded-2xl border bg-card/40 px-4 py-4">
        <header className="flex flex-col gap-0.5">
          <h2
            id={headingId}
            className="text-[13px] font-semibold tracking-tight"
          >
            {heading}
          </h2>
          {blurb ? (
            <p className="text-muted-foreground text-[11px] leading-snug">
              {blurb}
            </p>
          ) : null}
        </header>
        <div className={cn("flex flex-col gap-3", contentClassName)}>
          {children}
        </div>
      </div>
    </section>
  );
}
