"use client";

// PRODUCTS IS THE CATALOGUE: the gate, then the whole suite, and nothing else.
//
// A CARD STATES A FACT THE CONSOLE READ. Profile is free on every place;
// partner-gated products read Locked and carry NO verb, because a button on a
// product the caller cannot have is an invitation to a 403; a per-place product
// prints whether it is on HERE; a product that does not exist is Soon, and
// most of the suite is.
//
// A VERB LANDS WHEREVER THE PRODUCT ACTUALLY LIVES, and that is no longer one
// place. `PLACE_TABS` ⊇ `PRODUCT_KEYS` held while the suite was six views plus
// Customers; Pato's full list (MESITA-1946) broke it for good, so the
// destination is written down per product in `lib/products.ts` instead of cast
// out of the key. Customers is a page, Payments is the sub-step `products/pay`,
// and every Soon product but Capital has nothing at all to open.
// THE ONLY LUCIDE LEFT ON THIS PAGE. Every product mark is an emoji
// (MESITA-1952); the arrow and the lock are structure, not identity.
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NotHeld, useHeldPlaceOrNull, usePlaceScope } from "@/components/console/PlaceScope";
import { MembershipReturnNotice } from "@/components/console/MembershipReturnNotice";
import { PartnerBanner } from "@/components/console/PartnerBanner";
import { ProductStateBadge } from "@/components/shared/Badges";
import { buildProductCards } from "@/lib/products";
import { placePayHref } from "@/lib/console-routes";
import { placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import type { ProductKey } from "@/lib/product-keys";
import { SCOPE_CHIP_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// THE MARK, AND ONLY THE MARK (MESITA-1946) — AN EMOJI SINCE MESITA-1952.
//
// Pato: *"maybe some icon to each product"*, then, at the same grid once it
// had gone grey: *"add fuckjing emojis or something"*.
//
// The lucide glyphs came across from `web-business` and the TINTS did not,
// because this app has no hues to draw them in (MESITA-1934) — which left a
// grid of grey squares holding grey marks, the tint table with its only job
// removed. An emoji carries its own colour and costs the palette nothing: no
// hue to allocate, nothing for the next product to run out of, and the square
// stays one muted wash on every card.
//
// THE CHIP STILL DOES NOT BRIGHTEN WHEN A PRODUCT IS ON. State is the badge's
// fact, and Badges.tsx's first line is that there is never a second badge for
// one fact — on a screen whose whole job is saying which products are on, a
// quieter second state signal is the one that gets misread.
const PRODUCT_MARK: Record<ProductKey, string> = {
  profile: "\u{1F3EA}",
  website: "\u{1F310}",
  customers: "\u{1F465}",
  ads: "\u{1F4E3}",
  visits: "\u{1F39F}\u{FE0F}",
  orders: "\u{1F6CD}\u{FE0F}",
  reservations: "\u{1F4C5}",
  pay: "\u{1F4B3}",
  // THE READER, NOT A SECOND CARD: 📲 is the tap, the part of Terminal that is
  // not Payments — never a second 💳 in the same grid.
  terminal: "\u{1F4F2}",
  // THE ITEMS, the half of the counter Terminal is not: 🧾 is what was rung up
  // before anybody tapped anything.
  pos: "\u{1F9FE}",
  // A COIN, NOT A WALLET — Pay › Wallet is the guest's; credits are a balance
  // the place sold.
  credits: "\u{1FA99}",
  // The BANK'S FRONT, the same mark the landing page gives Capital.
  capital: "\u{1F3E6}",
  // NOT A HANDSET AND NOT A CHAT BUBBLE (MESITA-1951): either one would make
  // the card look like one channel's product again, which is the whole thing
  // the merge undid. 🤖 is what the name now says out loud.
  line: "\u{1F916}",
  intelligence: "\u{2728}",
};
export default function ProductsPage() {
  const place = useHeldPlaceOrNull();
  const { tabs, pages } = usePlaceScope();
  // THE GATE THESE PAGES WERE MISSING. They are static segments beside
  // `[view]`, so no tab gate ever runs for them: a pool id typed into the bar,
  // or the scenario flipped to a failed read while one of them was open, used
  // to reach the body with no place at all. It sits after the hooks and before
  // the first `place.` — a guard below a dereference is not a guard.
  if (!place) return <NotHeld />;
  // AND HELD AS WHAT (MESITA-1933). `NotHeld` above answers "is this place
  // held"; it has never answered the role, and until now nothing did for this
  // page — the rail's product rows were running `tabsForAccess` and that was
  // the whole console's role check. The rows are gone, so the gate is here.
  // `notFound`, like `PlaceTabGate`: a page reachable by typing its address is
  // a page, whatever the rail chose to draw.
  if (!pages.includes("products")) notFound();


  const cards = buildProductCards({
    partnered: place.partnered,
    mesitaPayEnabled: place.pay === "enabled",
    place,
    placeHref: (view: PlaceTab) => placeTabHref(place.id, view),
    payHref: placePayHref(place.id),
  });

  return (
    <>
      <MembershipReturnNotice />

      {/* THE GATE, ABOVE THE GRID, sized by the decision in it — a box when
          there is a purchase to make, one line when there is not. It is the
          one thing on the page that is not a card, because Partner is not a
          product: it is what five of them are behind. See PartnerCard.tsx for
          why it is not a ninth card in the grid. */}
      <PartnerBanner place={place} />

      {/* TWO ACROSS AT MOST (MESITA-1941). This was four across at xl, and on
          a fluid console that is eight 400px boxes carrying two sentences
          each — the catalogue of the whole product read as a chip rack. Two
          columns give each card room for its blurb, its fact and its verb on
          one line apiece. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((card) => {
          // Hidden from the rail is not hidden from here: the catalogue names
          // every product this place could have, and says which ones this
          // caller may open.
          // NO CAST. Most product keys are not `PlaceTab`s now, so
          // `key as PlaceTab` would be a lie the compiler accepts — and
          // one that reads `false` for every product whose destination is not
          // a view, which is the wrong answer for Payments.
          const allowed =
            card.key === "customers" ||
            (tabs as readonly string[]).includes(card.key);
          const mark = PRODUCT_MARK[card.key];
          return (
            <div
              key={card.key}
              className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      SCOPE_CHIP_CLASS,
                      "bg-muted text-foreground flex items-center justify-center",
                    )}
                  >
                    {/* `leading-none`: an emoji's line box is taller than the
                        glyph, so without it the mark sits low in its square. */}
                    <span className="text-[22px] leading-none">{mark}</span>
                  </span>
                  {/* ONE STEP UP (MESITA-1950). Pato: *"make the name a bit
                      larger here"*. At `text-base` the product's name was the
                      same size as the sentence describing it two lines below —
                      the thing you are CHOOSING BETWEEN, drawn at the rank of
                      the thing explaining it. */}
                  <p className="font-display min-w-0 text-lg font-semibold tracking-tight">
                    {card.name}
                  </p>
                </div>
                <ProductStateBadge state={card.state} />
              </div>
              <p className="text-muted-foreground flex-1 text-[13px] leading-relaxed">{card.blurb}</p>
              {card.note && <p className="text-[13px] font-medium">{card.note}</p>}
              {card.state === "locked" ? (
                <p className="text-muted-foreground flex items-center gap-1.5 text-[13px]">
                  <Lock className="h-4 w-4" aria-hidden />
                  Needs the Membership
                </p>
              ) : card.action && allowed ? (
                <Link
                  href={card.action.href}
                  className="text-foreground hover:text-primary inline-flex items-center gap-1.5 text-[13px] font-semibold"
                >
                  {card.action.label}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : card.action ? (
                <p className="text-muted-foreground text-[13px]">Your role cannot open this.</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
