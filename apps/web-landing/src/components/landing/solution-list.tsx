import type { Solution } from "@/components/landing/solutions";

// One card of numbered rows, the way Pato reads a product list: no tile grid.
// A row that is not built yet says Soon in words, not only in color.
function SolutionList({ items }: { items: Solution[] }) {
  return (
    <ol className="border-border bg-card divide-border shadow-elev divide-y overflow-hidden rounded-3xl border">
      {items.map(({ name, body, ways, soon }, i) => (
        <li
          key={name}
          className="flex gap-4 px-5 py-5 md:gap-6 md:px-7 md:py-6"
        >
          <span
            className={`font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              soon
                ? "bg-muted text-muted-foreground"
                : "bg-pink-gradient text-white"
            }`}
            aria-hidden
          >
            {i + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
              {name}
              {soon && (
                <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 font-sans text-[11px] font-medium tracking-normal">
                  Soon
                </span>
              )}
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
