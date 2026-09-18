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
import { notFound } from "next/navigation";
import {
  NotHeld,
  useHeldPlaceOrNull,
  usePlaceScope,
} from "@/components/console/PlaceScope";
import { MembershipReturnNotice } from "@/components/console/MembershipReturnNotice";
import { PartnerBanner } from "@/components/console/PartnerBanner";
import { ProductStateBadge } from "@/components/shared/Badges";
import { buildProductCards, type ProductCard } from "@/lib/products";
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
// grid of grey squares holding grey marks. An emoji carries its own colour and
// costs the palette nothing.
//
// THE CHIP STILL DOES NOT BRIGHTEN WHEN A PRODUCT IS ON. State is the badge's
// fact, and there is never a second badge for one fact — on a screen whose
// whole job is saying which products are on, a quieter second state signal is
// the one that gets misread.
const PRODUCT_MARK: Record<ProductKey, string> = {
  profile: "\u{1F3EA}",
  // THE DISHES, not a document: 🍽️ over 📄 or 📋, because the thing this
  // product turns into data is the food, and a page mark would read as the
  // PDF on Profile that this card exists to stop being the answer.
  menu: "\u{1F37D}\u{FE0F}",
  website: "\u{1F310}",
  customers: "\u{1F465}",
  ads: "\u{1F4E3}",
  visits: "\u{1F39F}\u{FE0F}",
  orders: "\u{1F6CD}\u{FE0F}",
  reservations: "\u{1F4C5}",
  pay: "\u{1F4B3}",
  // THE READER, NOT A SECOND CARD: 📲 is the tap, the part of Terminal that is
  // not Payments — never a second 💳 in the same list.
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
  // the row look like one channel's product again, which is the whole thing
  // the merge undid. 🤖 is what the name now says out loud.
  line: "\u{1F916}",
  intelligence: "\u{2728}",
};

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

  return (
    <>
      <MembershipReturnNotice />

      {/* THE GATE, ABOVE THE LIST, sized by the decision in it — a box when
          there is a purchase to make, one line when there is not. It is the
          one thing here that is not a product row, because Partner is not a
          product: it is what five of them are behind. */}
      <PartnerBanner place={place} />

      {GROUPS.map((group) => {
        const inGroup = cards.filter((c) => group.holds(c.state));
        // A group with nothing in it draws nothing. A heading over an empty
        // list is a promise the page cannot keep.
        if (inGroup.length === 0) return null;
        return (
          <section key={group.title} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              {/* AppShell's sr-only `h1`, then these, then the product names,
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
                  "flex items-center gap-3 px-4 py-3.5 min-h-14 text-left";
                return open ? (
                  <Link
                    key={card.key}
                    href={open.href}
                    aria-label={`${open.label} · ${card.name}`}
                    className={cn(ROW, "hover:bg-muted/60 transition")}
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={card.key} className={ROW}>
                    {body}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
