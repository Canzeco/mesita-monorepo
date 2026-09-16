// Capital — cash now against meals this place will serve later.
//
// IT IS NOT A LOAN, and that sentence is the product. Mesita pre-buys a
// restaurant's future meals at a discount and resells that inventory to
// guests: the place takes cash today, the guest buys at a discount, and Mesita
// keeps the spread. Nothing is borrowed and nothing accrues. The copy is the
// landing page's own (`web-landing/.../capital-credits.tsx`), deliberately, so
// the pitch an owner read before signing up is the pitch they meet inside —
// and so no screen here can drift into implying credit.
//
// NOTHING IS BUILT (MESITA-1929). No `capital` table, no migration, no Edge
// Function. Pato asked for it on the catalogue — "where is Capital, include
// Capital there" — and the honest answer is a card, a row and a page that says
// not yet. House law (SoonStrip.tsx): an unbuilt engine shows Soon, never
// knobs, never a fake feed. So this page has no ladder and no zone.
//
// IT READS NOTHING. The layout above resolved the place once (MESITA-1875) and
// its heading names it.
import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";

export default function CapitalPage() {
  return (
    <>
      <p className="text-muted-foreground text-sm leading-snug">
        Take cash now against meals you have not served yet. An advance sale of
        food, never a loan. Nothing is live yet.
      </p>
      <SoonStrip {...SOON_STRIPS.capital} />
    </>
  );
}
