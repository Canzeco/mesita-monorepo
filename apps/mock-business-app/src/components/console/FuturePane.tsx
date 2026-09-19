"use client";

// FUTURE PRODUCTS — the eleventh row, holding everything the ten leaves out
// (MESITA-1997).
//
// Pato, 2026-09-19: *"i don't want a coming then shit. I just want a list of
// products and then just building some shit called future products and then
// at the right you put everything."*
//
// WHAT WAS WRONG WITH THE GROUPS. The index sorted itself into RUNNING and
// COMING by each card's `state`, so nine unbuilt products took nine rows and
// pushed the built ones up into a list whose length was set by the roadmap.
// An operator scanning for Online Payments scrolled past a POS that does not
// exist. The roadmap is worth one row, not nine.
//
// IT IS NOT A PRODUCT. No `ProductKey`, no slug in `PRODUCT_SLUG`, no card —
// the same sentinel shape the Plan row is, for the same reason: giving it a
// key would put it in every loop that iterates the suite.
//
// EVERY ROW HERE READS "Soon" EXCEPT ONE. The Developers Platform is live and
// still landed outside the ten, so this pane must not tell an operator it is
// unbuilt — every row prints its own state word, and the heading says
// "outside the ten" rather than "being built".
import { PRODUCT_MARK } from "@/lib/product-marks";
import type { ProductCard } from "@/lib/products";

const STATE_WORD: Record<ProductCard["state"], string> = {
  free: "Free",
  enabled: "On",
  off: "Off",
  locked: "Locked",
  soon: "Soon",
};

export function FuturePane({ cards }: { cards: ProductCard[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Future products
        </h2>
        {/* IT CANNOT SAY "what Mesita is building next" (MESITA-1997). The
            Developers Platform is LIVE and still landed outside the ten, so a
            heading that called everything below unbuilt would be false on its
            own list — and false in the expensive direction, telling an
            operator a product they already have is not here. The list is
            defined by SUBTRACTION, so the sentence says subtraction, and each
            row carries its own real state. */}
        <p className="text-muted-foreground mt-1 max-w-[56ch] text-[13px] leading-snug">
          Everything outside the ten. Most of it is not built yet — each row
          says which, and nothing below shows a knob or a number it has not
          measured.
        </p>
      </div>
      <ul className="flex flex-col gap-px">
        {cards.map((card) => (
          <li
            key={card.key}
            className="flex items-start gap-2.5 rounded-lg px-2 py-2"
          >
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center text-[17px] leading-none"
            >
              {PRODUCT_MARK[card.key]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium">{card.name}</p>
              <p className="text-muted-foreground mt-0.5 text-[12.5px] leading-snug">
                {card.note ?? card.blurb}
              </p>
            </div>
            {/* The row's own state, so the one live product here is not read
                as unbuilt just because of the company it keeps. */}
            <span className="text-muted-foreground shrink-0 text-[12px]">
              {STATE_WORD[card.state]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
