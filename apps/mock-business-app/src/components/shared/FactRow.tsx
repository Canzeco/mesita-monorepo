// THE FACTS A CARD KNOWS, SAID ONCE EACH.
//
// A labelled row of short values under a card's lede. It exists because the
// obvious spelling — a fixed set of columns, nulled out per state — produces
// the bug it was written to avoid: a label over a blank cell. An empty fact is
// not a fact, so the CALLER passes the facts that exist and this renders
// exactly those. There is no "unknown" rendering, and no em dash placeholder:
// a state with nothing to say passes an empty array and gets no row at all.
//
// Responsive on purpose, not by accident (MESITA-1916). Three across at 375px
// wraps wherever the longest VALUE happens to fall, which changes the card's
// shape per place and per state with nobody having chosen it. Below `sm` this
// is one fact per line, label over value, hairline between; from `sm` up it is
// the row. Same markup, one breakpoint.
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";

export type Fact = {
  /** The label. Also the React key, so two facts in one row never share one. */
  k: string;
  v: string;
  /** A qualifier the value cannot carry alone — "permanent", "set on Stripe".
   *  Reads at normal weight after a middot so it never competes with `v`. */
  note?: string;
};

export function FactRow({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) return null;
  return (
    <dl className="border-border/70 mt-1 flex flex-col border-t pt-4 sm:flex-row sm:flex-wrap sm:gap-x-12 sm:gap-y-4">
      {facts.map((f) => (
        <div
          key={f.k}
          className="border-border/60 flex min-w-0 flex-col border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0 sm:border-b-0 sm:py-0"
        >
          <dt className={TINY_LABEL_CLASS}>{f.k}</dt>
          <dd className="mt-1 text-sm font-semibold">
            {f.v}
            {f.note && (
              <span className="text-muted-foreground font-normal">
                {" · "}
                {f.note}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
