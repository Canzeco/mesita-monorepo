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
import {
  ArrowRight,
  CalendarCheck,
  CreditCard,
  Gift,
  Globe,
  Headset,
  Landmark,
  Lock,
  Megaphone,
  Nfc,
  ScanBarcode,
  ShoppingBag,
  Sparkles,
  Store,
  Ticket,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
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

// THE MARK, AND ONLY THE MARK (MESITA-1946).
//
// Pato: *"maybe some icon to each product"*. `web-business` has carried these
// nine glyphs since the catalogue shipped, each in a tinted chip — teal for
// Profile, violet for Payments, and so on. THE GLYPHS COME ACROSS UNCHANGED
// and the TINTS DO NOT: one product drawn two ways is how an operator learns
// to distrust both drawings, and this app has no hues to draw them in
// (MESITA-1934). Nine washes of the same grey would be the tint table with its
// only job removed.
//
// So the chip is one muted square on every card and the GLYPH is the whole of
// the identity. That is also why the chip does not brighten when a product is
// on: state is the badge's fact, and Badges.tsx's first line is that there is
// never a second badge for one fact. A mark that changed with state would be
// exactly that — and on a screen whose entire job is saying which products are
// on, a second, quieter state signal is the one that gets misread.
const PRODUCT_MARK: Record<ProductKey, LucideIcon> = {
  profile: Store,
  website: Globe,
  customers: Users,
  ads: Megaphone,
  visits: Ticket,
  rewards: Gift,
  orders: ShoppingBag,
  reservations: CalendarCheck,
  pay: CreditCard,
  // THE READER, NOT A SECOND CARD (MESITA-1946). Terminal wore `CreditCard`
  // before MESITA-1900 removed it, back when Payments wore something else;
  // giving it back now would put the same glyph on two cards in one grid,
  // which is the tint table's failure in monochrome. `Nfc` is the tap, which
  // is the part of Terminal that is not Payments.
  terminal: Nfc,
  // THE ITEMS, which is the half of the counter Terminal is not: `Nfc` is the
  // tap, `ScanBarcode` is what was rung up before anybody tapped anything.
  pos: ScanBarcode,
  credits: Wallet,
  // The BANK'S FRONT, the same glyph the landing page gives Capital.
  capital: Landmark,
  // THE SWITCHBOARD, not a phone and not a chat bubble (MESITA-1951). This one
  // mark stands where the chat bubble and the handset stood, and picking either
  // of those back would make the card look like one channel's product again —
  // which is the whole thing the merge undid.
  line: Headset,
  intelligence: Sparkles,
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
          const Mark = PRODUCT_MARK[card.key];
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
                    <Mark className="h-5 w-5" strokeWidth={1.75} />
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
