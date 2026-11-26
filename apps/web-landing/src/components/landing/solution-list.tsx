import type { Solution } from "@/components/landing/solutions";

// One card of numbered rows, the way Pato reads a product list: no tile grid.
// `start` numbers a second list on from the first (Modules runs two columns).
function SolutionList({
  items,
  start = 1,
}: {
  items: Solution[];
  start?: number;
}) {
  return (
    <ol className="border-border bg-card divide-border shadow-elev divide-y overflow-hidden rounded-3xl border">
      {items.map(({ name, body, ways }, i) => (
        <li
          key={name}
          className="flex gap-4 px-5 py-5 md:gap-6 md:px-7 md:py-6"
        >
          <span
            className="font-display bg-pink-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            aria-hidden
          >
            {start + i}
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
              {name}
            </h3>
            <p className="text-muted-foreground text-[15px] leading-relaxed">
              {body}
            </p>
            {ways && (
              <ul className="flex flex-wrap gap-1.5 pt-1.5">
                {ways.map((w) => (
                  <li
                    key={w}
                    className="bg-primary/10 text-secondary rounded-full px-2.5 py-1 text-xs font-medium"
                  >
                    {w}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export { SolutionList };
