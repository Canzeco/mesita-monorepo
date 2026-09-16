// THE BOX, SAID ONCE. One card primitive for every long-form surface, so the
// console has one kind of container rather than a local `Section` per file.
//
// `lane` splits the card into a 288px LABEL lane and a content lane. The
// console is FLUID — no max-width — so a stacked card is ~1690px wide, which
// puts the title at the far left edge and its one control at the far right with
// 1400px of white between them. That is not spacious, it is broken. The lane
// caps a COLUMN INSIDE the card, which is the same move FORM_COLUMN_CLASS makes
// and the opposite of capping the card itself.
//
// It is a PROP, not the default: a silent layout change to every card in the
// console is how three screens break at once.
import { cn } from "@/lib/utils";

export function Section({
  id,
  title,
  titleClassName,
  description,
  right,
  children,
  className,
  lane = false,
}: {
  id?: string;
  /** A node, not just a string: a card whose heading IS its status wants the
   *  badge inside the heading rather than stranded at the far right edge of a
   *  1690px card (MESITA-1916). */
  title: React.ReactNode;
  /** Overrides the heading's type scale. The default stays 14px — this is for
   *  the one card per screen whose heading is the thing you came to read. */
  titleClassName?: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  lane?: boolean;
}) {
  const header = (
    <div className={cn("min-w-0", lane ? "flex flex-col gap-3" : "flex-1")}>
      <div>
        <h3
          className={cn(
            "font-display text-sm font-semibold tracking-tight",
            titleClassName,
          )}
        >
          {title}
        </h3>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
            {description}
          </p>
        )}
      </div>
      {/* In lane mode the action sits under its own label rather than across
          the card, so it never becomes a second stranded right edge. */}
      {lane && right && <div>{right}</div>}
    </div>
  );

  return (
    <section
      id={id}
      className={cn(
        // `main` is the only scroller, so scroll-mt is what keeps a linked-to
        // heading clear of the chrome above it.
        id && "scroll-mt-6",
        "border-border bg-card rounded-2xl border p-4",
        lane
          ? "grid grid-cols-1 gap-3 lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-8"
          : "flex flex-col gap-3",
        className,
      )}
    >
      {lane ? (
        header
      ) : (
        <div className="flex items-start justify-between gap-3">
          {header}
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      {lane ? (
        <div className="flex min-w-0 flex-col gap-3">{children}</div>
      ) : (
        children
      )}
    </section>
  );
}
