"use client";

// SETUP — the shop and the switchboard, which are one list (MESITA-1973).
//
// This was `products`, a CATALOGUE: fifteen cards that stated facts while every
// switch lived on the product's own view. A product therefore existed twice, at
// two addresses, and the two could disagree — which is not hypothetical, it is
// the bug MESITA-1953 had to write a paragraph of workaround for on the Visits
// card, and it is why Payments' Stripe setup ended up at `products/pay`, inside
// the shop.
//
// ONE ROW PER PRODUCT, AND THE ROW IS THE DOOR. Off says what the product does;
// On says how it is set. Tapping drills into the product's own view, which is
// unchanged — same address, same key, same page.
//
// ── ROWS, NOT A GRID OF CARDS ──────────────────────────────────────────────
//
// The grid was four across and fifteen tall (MESITA-1956), sized so an operator
// could read the whole suite before wanting any of it. That was right for a
// SHOP. It is wrong for a list you come back to weekly to change one dial: a
// card is a box you compare, a row is a thing you open, and this page is now
// mostly the second job. Rows also survive a phone, which four columns never
// did — and the four-tab IA exists so that web and mobile are the same console.
//
// ── THREE GROUPS, FROM THE STATE THE CONSOLE ALREADY READ ──────────────────
//
//   RUNNING   free + enabled     what this place has
//   OFF       off + locked       what it could turn on, and what needs the
//                                Membership first
//   COMING    soon               named, no page, no promise of a date
//
// NOT `PRODUCT_BANDS`. The four bands group the suite by what a product is FOR
// and they are the right grouping for a shop. Here the question is what is
// running, so the grouping is state — and it re-sorts the list, which the bands
// deliberately never did.
//
// A LOCKED ROW CARRIES NO VERB, unchanged: a button on a product the caller
// cannot have is an invitation to a 403.
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import {
  NotHeld,
  useHeldPlaceOrNull,
  usePlaceScope,
} from "@/components/console/PlaceScope";
import { MembershipReturnNotice } from "@/components/console/MembershipReturnNotice";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { ProductPane } from "@/components/console/ProductPane";
import { PartnerBanner } from "@/components/console/PartnerBanner";
import { ProductStateBadge } from "@/components/shared/Badges";
import { buildProductCards, type ProductCard } from "@/lib/products";
import { PLACE_PAGE_LABEL, placePayHref } from "@/lib/console-routes";
import { placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import type { ProductKey } from "@/lib/product-keys";
import { PRODUCT_MARK } from "@/lib/product-marks";
import { SCOPE_CHIP_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";



/** The three groups, in the order an operator needs them: what is running,
 *  what could be, what is not built. Each is a predicate over the state the
 *  console already read — no second source of truth about what is on. */
const GROUPS: readonly {
  title: string;
  hint: string;
  holds: (state: ProductCard["state"]) => boolean;
}[] = [
  {
    title: "Running",
    hint: "On this place now.",
    holds: (s) => s === "free" || s === "enabled",
  },
  {
    title: "Off",
    hint: "Available, not turned on.",
    holds: (s) => s === "off" || s === "locked",
  },
  {
    title: "Coming",
    hint: "Named, not built. No page yet.",
    holds: (s) => s === "soon",
  },
];

export default function SetupPage() {
  // EVERY HOOK BEFORE THE FIRST `notFound()`. This page has three early exits
  // — no place, no `setup` in `pagesForAccess`, and `notFound` itself — and a
  // hook read after any of them changes the hook ORDER between renders, which
  // is the one React rule eslint refuses to let ship.
  const chosenKey = useSearchParams().get("p");
  const place = useHeldPlaceOrNull();
  const { tabs, pages } = usePlaceScope();
  // THE GATE. Static segments beside `[view]` get no tab gate, so a pool id
  // typed into the bar used to reach the body with no place at all. It sits
  // after the hooks and before the first `place.` — a guard below a
  // dereference is not a guard.
  if (!place) return <NotHeld />;
  // AND HELD AS WHAT. `NotHeld` answers "is this place held" and never the
  // role; `pagesForAccess` is the matrix, and `notFound` is what refuses the
  // address. Hidden is not protected.
  if (!pages.includes("setup")) notFound();

  const cards = buildProductCards({
    partnered: place.partnered,
    mesitaPayEnabled: place.pay === "enabled",
    place,
    placeHref: (view: PlaceTab) => placeTabHref(place.id, view),
    payHref: placePayHref(place.id),
  });

  // WHICH PRODUCT IS OPEN. The selection lives in the ADDRESS, not in state:
  // a pane is then linkable, Back walks the products you looked at, and a
  // reload lands where you were. `?p=` rather than a path segment because the
  // page is one screen with a selection, not two screens.
  //
  // THE DESKTOP DEFAULT IS THE FIRST PRODUCT, never nothing. Half a screen
  // holding an empty state on arrival is half a screen teaching you that it is
  // usually empty. `open` — whether the ADDRESS names one — is what the phone
  // reads, so below `lg` you still get the list first.
  const selected = cards.some((c) => c.key === chosenKey)
    ? (chosenKey as ProductKey)
    : cards[0]?.key;
  const card = cards.find((c) => c.key === selected) ?? null;
  const open = chosenKey !== null;

  const list = (
    <>
      {GROUPS.map((group) => {
        const inGroup = cards.filter((c) => group.holds(c.state));
        // A group with nothing in it draws nothing. A heading over an empty
        // list is a promise the page cannot keep.
        if (inGroup.length === 0) return null;
        return (
          <section key={group.title} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              {/* `PlaceHeading`'s `h1`, then these, then the product names,
                  which are `<p>` on purpose — a row's name is a label, and an
                  outline made of fifteen headings is not an outline. */}
              <h2 className="font-display text-sm font-semibold tracking-tight">
                {group.title}
              </h2>
              <p className="text-muted-foreground text-[13px]">{group.hint}</p>
            </div>
            <div className="border-border bg-card divide-border divide-y rounded-2xl border">
              {inGroup.map((card) => {
                // NO CAST. Most product keys are not `PlaceTab`s, so
                // `key as PlaceTab` would be a lie the compiler accepts, and
                // one that reads false for Payments — whose destination is a
                // view but whose action is built from `payHref`.
                const allowed = (tabs as readonly string[]).includes(card.key);
                const open = card.action && allowed ? card.action : null;
                // THE WHOLE ROW IS THE TARGET when there is one. A row whose
                // only hit area is a four-word link at the right edge is a
                // 44px-tall thing you have to aim at.
                const body = (
                  <>
                    <span
                      aria-hidden
                      className={cn(
                        SCOPE_CHIP_CLASS,
                        "bg-muted text-foreground flex shrink-0 items-center justify-center",
                      )}
                    >
                      {/* `leading-none`: an emoji's line box is taller than
                          the glyph, so without it the mark sits low. */}
                      <span className="text-[22px] leading-none">
                        {PRODUCT_MARK[card.key]}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-display text-[15px] font-semibold tracking-tight">
                        {card.name}
                      </span>
                      {/* THE NOTE WINS WHERE THERE IS ONE. A note is what this
                          product is doing HERE ("64 dishes", "Nothing is live
                          yet"); the blurb is what the product is, which the
                          operator already knows once it is running. */}
                      <span className="text-muted-foreground text-[13px] leading-snug">
                        {card.note ?? card.blurb}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <ProductStateBadge state={card.state} />
                      {card.state === "locked" ? (
                        <Lock
                          className="text-muted-foreground h-4 w-4"
                          aria-label="Needs the Membership"
                        />
                      ) : open ? (
                        <ArrowRight
                          className="text-muted-foreground h-4 w-4"
                          aria-hidden
                        />
                      ) : (
                        // The column stays the same width whether or not the
                        // row opens, so the badges line up down the list.
                        <span className="h-4 w-4" aria-hidden />
                      )}
                    </span>
                  </>
                );
                const ROW =
                  "flex items-center gap-3 px-4 py-3.5 min-h-14 text-left w-full";
                // EVERY ROW IS A SELECTION NOW (MESITA-1981), including the
                // nine Coming ones. The pane on the right always has something
                // true to say about a product — its dial, or that there is
                // nothing to set yet — so a row that did nothing when clicked
                // would be the only dead thing on a screen built for picking.
                // `open` survives as the ARIA label's verb and as the arrow's
                // condition: it is still what says whether this product has a
                // screen behind it.
                const chosen = card.key === selected;
                return (
                  <Link
                    key={card.key}
                    href={`?p=${card.key}`}
                    scroll={false}
                    aria-current={chosen ? "true" : undefined}
                    aria-label={`${open ? open.label : "Open"} · ${card.name}`}
                    className={cn(
                      ROW,
                      "transition",
                      chosen ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    {body}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );

  return (
    <>
      <PlaceHeading
        name={place.name}
        photoUrl={place.photoUrl}
        page={PLACE_PAGE_LABEL.setup}
      />

      <MembershipReturnNotice />

      {/* ABOVE BOTH HALVES, FULL WIDTH. The Membership is about the PLACE, not
          about whichever product is open on the right, and a gate that moved
          into one column would read as that column's condition. */}
      <PartnerBanner place={place} />

      {/* 50/50 (MESITA-1981). Pato: *"two screns, 50% and 50%"*.
          
          THE PAGE STAYS THE ONLY SCROLLER, and that is deliberate. Two
          independently scrolling halves would put a second scroll container
          inside `main`, and this app has already shipped the bug where a
          height chain loses its definite parent and a full-height card renders
          as an empty box with every check green. The LIST is `sticky` with a
          max-height measured in `vh` — a definite height that comes from the
          viewport rather than from a parent chain — so the left column holds
          while the right one scrolls the page.
          
          `lg:items-start` is load-bearing for that sticky: a stretched grid
          item is as tall as its row, and a sticky element as tall as its own
          container never sticks to anything. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
        {/* ONE AT A TIME BELOW `lg`. 50/50 does not exist on a 375px phone, so
            the two halves become master-detail: the list, then the pane, with
            the pane carrying the way back. */}
        <div
          className={cn(
            "flex-col gap-4 lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1",
            open ? "hidden" : "flex",
          )}
        >
          {list}
        </div>

        <div className={cn(open ? "block" : "hidden", "lg:block")}>
          {card ? (
            <ProductPane card={card} />
          ) : (
            // NEVER ON DESKTOP: `selected` falls back to the first card, so
            // this is only reachable if `SPECS` is empty, which the type system
            // does not forbid and the app does not survive anyway.
            <p className="text-muted-foreground text-sm">No products here.</p>
          )}
        </div>
      </div>
    </>
  );
}
