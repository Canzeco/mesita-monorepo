"use client";

// Capital — cash now against meals this place will serve later.
//
// IT IS NOT A LOAN, and that sentence is the whole product. Mesita pre-buys a
// restaurant's future meals at a discount and resells that inventory to
// guests: the place takes cash today, the guest buys at a discount, and Mesita
// keeps the spread. Nothing is borrowed and nothing accrues, so no screen here
// may ever use the word — a console that implies lending is a console making a
// claim its own landing page contradicts. The copy is the landing's
// (`web-landing/src/components/landing/capital-credits.tsx`), deliberately, so
// the pitch an owner read before signing up is the pitch they meet inside.
//
// NOTHING IS BUILT (MESITA-1929). There is no `capital` table, no migration and
// no Edge Function; Pato asked for it on the catalogue — "where is Capital,
// include Capital there" — and the honest answer is a row, a card and a page
// that says not yet. That is the same shape Customers ships in.
//
// SO THIS PAGE HAS NO HALVES. `Half` splits a product into what you SET and
// what HAPPENED (MESITA-1924); Capital has neither yet, and a Manage heading
// over a Soon strip would promise a control that does not exist.
import { useHeldPlace } from "@/components/console/PlaceScope";
import { SoonStrip } from "@/components/shared/SoonStrip";
import { Tiles } from "@/components/shared/Tiles";

export function CapitalView() {
  // Read for the gate's sake: a view that never touches the place would render
  // for a pool id the same as for a held one.
  useHeldPlace();
  return (
    <div className="flex flex-col gap-4">
      {/* THE TILES ARE THE PITCH, not a reading. Every other product's tiles
          count something that happened; there is nothing to count here, so
          these state the DEAL — the three numbers an owner is deciding
          between. `value` carries the figure and `hint` carries whose it is,
          which is the same shape the other views use for a fact they did not
          compute. */}
      <Tiles
        tiles={[
          { label: "What you get", value: "Cash now", hint: "Against meals you have not served yet" },
          { label: "What the guest gets", value: "20% off", hint: "They buy the meal forward, at a discount" },
          { label: "What it is not", value: "A loan", hint: "An advance sale of food — nothing is borrowed" },
        ]}
      />

      <SoonStrip title="Mesita Capital is not live yet">
        Mesita pre-buys a restaurant&rsquo;s future meals at a deep discount and
        resells that inventory to guests. The place gets cash now, the guest
        gets a better price, and Mesita keeps the spread. There is no offer to
        accept on this screen yet — no amount, no terms and no paperwork — and
        there will not be one until the engine behind it exists.
      </SoonStrip>
    </div>
  );
}
