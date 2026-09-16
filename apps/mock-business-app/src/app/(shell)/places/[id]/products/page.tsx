"use client";

// PRODUCTS IS THE CATALOGUE: a banner and eight cards, and nothing else.
//
// A CARD STATES A FACT THE CONSOLE READ. Profile is free on every place;
// partner-gated products read Locked and carry NO verb, because a button on a
// product the caller cannot have is an invitation to a 403; a per-place product
// prints whether it is on HERE; Customers is Soon.
//
// A verb lands on the product's OWN view. There is no "product view" indirection
// left — `PLACE_TABS` ⊇ `PRODUCT_KEYS`, pinned both ways — except for Customers,
// which is a page, and Payments, whose Stripe account is the sub-step
// `products/pay` rather than a ninth card.
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { NotHeld, useHeldPlaceOrNull, usePlaceScope } from "@/components/console/PlaceScope";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { ProductStateBadge } from "@/components/shared/Badges";
import { buildProductCards } from "@/lib/products";
import { placePayHref } from "@/lib/console-routes";
import { placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import { CTA_BUTTON_CLASS, TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export default function ProductsPage() {
  const place = useHeldPlaceOrNull();
  const { tabs } = usePlaceScope();
  // THE GATE THESE PAGES WERE MISSING. They are static segments beside
  // `[view]`, so no tab gate ever runs for them: a pool id typed into the bar,
  // or the scenario flipped to a failed read while one of them was open, used
  // to reach the body with no place at all. It sits after the hooks and before
  // the first `place.` — a guard below a dereference is not a guard.
  if (!place) return <NotHeld />;


  const cards = buildProductCards({
    partnered: place.partnered,
    mesitaPayEnabled: place.pay === "enabled",
    place,
    placeHref: (view: PlaceTab) => placeTabHref(place.id, view),
    payHref: placePayHref(place.id),
  });

  return (
    <>
      <PlaceHeading place={place} view="Products" />

      {/* THE BANNER, ABOVE THE GRID. It is the one thing on the page that is
          not a card, because Partner is not a product — it is the gate five of
          them are behind. */}
      <div
        className={cn(
          "rounded-2xl border p-4",
          place.partnered
            ? "border-[color:var(--tier-gold)]/40 bg-[color:var(--tier-gold)]/8"
            : "border-border bg-card shadow-card",
        )}
      >
        <p className={TINY_LABEL_CLASS}>Mesita Membership</p>
        <p className="font-display mt-1 text-xl font-semibold tracking-tight">
          {place.partnered ? "This place is a Mesita Partner" : "This place is not a partner"}
        </p>
        <p className="text-muted-foreground mt-1 max-w-prose text-[13px] leading-snug">
          {place.partnered
            ? "The Membership is the SKU — bought per place, yearly. Partner is the status it grants, and it is what five of the eight products below read."
            : "Five of the eight products below need it. Bought per place, yearly; Mesita Payments is an add-on on top."}
        </p>
        {!place.partnered && (
          <Link href="#" className={cn(CTA_BUTTON_CLASS, "mt-3")}>
            See the Membership
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          // Hidden from the rail is not hidden from here: the catalogue names
          // every product this place could have, and says which ones this
          // caller may open.
          const allowed =
            card.key === "customers" ||
            tabs.includes(card.key as PlaceTab);
          return (
            <div
              key={card.key}
              className="border-border bg-card shadow-card flex flex-col gap-2 rounded-2xl border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-sm font-semibold tracking-tight">{card.name}</p>
                <ProductStateBadge state={card.state} />
              </div>
              <p className="text-muted-foreground flex-1 text-[12px] leading-snug">{card.blurb}</p>
              {card.note && <p className="text-[12px] font-medium">{card.note}</p>}
              {card.state === "locked" ? (
                <p className="text-muted-foreground flex items-center gap-1.5 text-[12px]">
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  Needs the Membership
                </p>
              ) : card.action && allowed ? (
                <Link
                  href={card.action.href}
                  className="text-foreground hover:text-primary inline-flex items-center gap-1 text-[12px] font-semibold"
                >
                  {card.action.label}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ) : card.action ? (
                <p className="text-muted-foreground text-[12px]">Your role cannot open this.</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
