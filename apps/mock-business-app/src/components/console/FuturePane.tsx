"use client";

// THE SUITE, AS A CATALOGUE (MESITA-1999).
//
// Pato: *"DON'T SHOW THIS IN LIST FORMAT BUT IN CATALOG FORMAT, BOXES, MAYBE
// 3 COLUMNS. SHOW CURRENT AND FUTURE PRODUCTS, WITH GREAT EXPLAINATIONS"*.
//
// It was nine rows of name-and-clause behind the Future products door
// (MESITA-1997). A row is the right shape for a thing you are scanning past;
// this pane is the opposite surface — it is read once, slowly, by somebody
// deciding whether they want any of this. So it is boxes, and it holds the
// WHOLE suite rather than only the part that is unbuilt.
//
// ── TWO AXES, AND THIS PANE IS NOT THE RAIL'S ─────────────────────────────
//
// The rail splits on `PRODUCT_ORDER`: the rows Pato chose, everything else
// behind one door. This pane splits on BUILT: Coming next, then Running
// today. They disagree, on purpose and in exactly one place — Express
// Website has a row AND is not built, so it is a rail row and a Coming box at
// the same time. (MESITA-2011 briefly removed that row and with it the
// disagreement; MESITA-2013 put both back.) Both statements are true, so the
// pane names its own axis in the sentence under the heading rather than
// leaving a reader to assume it inherited the rail's.
//
// COMING LEADS, because that is what the row said it was for. Running today
// follows, as the answer to the question the first section provokes — "so
// what do I have already?".
//
// ── WHAT A BOX SAYS ───────────────────────────────────────────────────────
//
// The mark, the name, the state word, the rung it needs, and the paragraph.
// The RUNG is the reason a box is worth more than a row here: an operator
// reading about the Answering Agent needs to know it is Ultra's in the same
// glance, or the copy sells them something the plan strip then refuses.
//
// A FREE product prints no rung line. "Needs Free" is not a sentence, and a
// row of them under four boxes would read as a price on something that has
// none.
import { PageHeader } from "@/components/console/PageHeader";
import { PLAN_LABEL } from "@/mock/types";
import { PRODUCT_MARK } from "@/lib/product-marks";
import { PRODUCT_CATALOG_COPY } from "@/lib/product-catalog";
import { MIN_PLAN, type ProductCard } from "@/lib/products";

const STATE_WORD: Record<ProductCard["state"], string> = {
  free: "Free",
  enabled: "On",
  off: "Off",
  locked: "Locked",
  soon: "Soon",
};

/** The grid. THREE at `lg` — Pato's "maybe 3 columns" — and this pane is two
 *  thirds of the shell, so three here is three across roughly 900px, which is
 *  a ~280px box: wide enough for three lines of the paragraph and no wider
 *  than a column anybody reads comfortably. Two at `sm`, one on a phone. */
const GRID = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";

function Box({ card }: { card: ProductCard }) {
  const min = MIN_PLAN[card.key];
  return (
    <div className="border-border/60 bg-card flex flex-col gap-2 rounded-xl border p-3.5">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center text-[17px] leading-none"
        >
          {PRODUCT_MARK[card.key]}
        </span>
        <p className="min-w-0 flex-1 text-[13.5px] leading-snug font-semibold">
          {card.name}
        </p>
        <span className="text-muted-foreground shrink-0 text-[11px]">
          {STATE_WORD[card.state]}
        </span>
      </div>
      <p className="text-muted-foreground text-[12.5px] leading-relaxed">
        {PRODUCT_CATALOG_COPY[card.key]}
      </p>
      {min !== "free" && (
        <p className="text-muted-foreground/80 mt-auto pt-1 text-[11px]">
          {PLAN_LABEL[min]}
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  lede,
  cards,
}: {
  title: string;
  lede: string;
  cards: ProductCard[];
}) {
  if (cards.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-display text-sm font-semibold tracking-tight">
          {title}
        </h3>
        <p className="text-muted-foreground mt-0.5 text-[12.5px] leading-snug">
          {lede}
        </p>
      </div>
      <div className={GRID}>
        {cards.map((card) => (
          <Box key={card.key} card={card} />
        ))}
      </div>
    </section>
  );
}

export function FuturePane({ cards }: { cards: ProductCard[] }) {
  // BUILT is the split, and `state === "soon"` is the only honest test for
  // it: a card is Soon when its spec says there is no engine behind it, which
  // is a different question from whether it is one of the ten.
  const coming = cards.filter((c) => c.state === "soon");
  const running = cards.filter((c) => c.state !== "soon");

  return (
    <div className="flex flex-col gap-6">
      {/* THE SHARED HEADER (MESITA-2008). It drew a bare heading — no mark,
          no badge — while every product pane one click away drew all three.
          It has a mark now for the same reason they do: the thing you clicked
          is the thing that greets you. */}
      <PageHeader
        mark={"\u{1F52E}"}
        title="The Mesita suite"
        blurb="Everything Mesita runs for a place, and everything it is building next. Nothing here is switched on by reading it — each product is turned on from its own screen, and the plan it needs is printed under it."
      />
      <Section
        title="Coming next"
        lede="Not built yet. No knobs and no numbers until there is an engine behind them."
        cards={coming}
      />
      <Section
        title="Running today"
        lede="Live on Mesita. Whether it is on at THIS place is what the list on the left says."
        cards={running}
      />
    </div>
  );
}
