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
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import {
  NotHeld,
  useHeldPlaceOrNull,
  usePlaceScope,
} from "@/components/console/PlaceScope";
import { MembershipReturnNotice } from "@/components/console/MembershipReturnNotice";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { membershipLine } from "@/components/console/PartnerCard";
import { Badge } from "@/components/shared/Badges";
import type { MockPlace } from "@/mock/types";
import { ProductPane } from "@/components/console/ProductPane";
import { PartnerBanner } from "@/components/console/PartnerBanner";
import { ProductStateBadge } from "@/components/shared/Badges";
import { buildProductCards, type ProductCard } from "@/lib/products";
import { PLACE_PAGE_LABEL, placePayHref } from "@/lib/console-routes";
import { placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import type { ProductKey } from "@/lib/product-keys";
import { PRODUCT_MARK } from "@/lib/product-marks";
import { SCOPE_CHIP_CLASS, SHELL_BLEED, SHELL_GUTTER } from "@/lib/ui-classes";
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

/** Mesita Partnership's id in `?p=` (MESITA-1982). Pato: *"ITS NOT FUCKING
 *  MEMBERSHIP, ITS PARTNERSHIP. ADD IT AS AN EXTRA PRODUCT SOLUTION"*.
 *
 *  MEMBERSHIP was the word for the SKU and Partner for the status; what the
 *  console sells a place is the partnership, so that is what the row is called
 *  and what its pane is headed. A STRING BESIDE `ProductKey`, never inside
 *  it: `PRODUCT_KEYS` is what the catalogue, the bands and `buildProductCards`
 *  all iterate, and a membership in that array would be a product carrying a
 *  state, a price and a Soon note it can never have. */
const MEMBERSHIP = "partnership";

/** The band the Partnership row joins. Read from `GROUPS` rather than typed
 *  twice: a renamed band would otherwise drop the row silently. */
const RUNNING_TITLE = "Running";

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
  // MEMBERSHIP IS A ROW IN THE LIST NOW (MESITA-1982). Pato: *"membership goes
  // in other part, maybe as extra category. In the list, almost as a product
  // solution."* It was a full-width card above both halves, which made the one
  // thing that GATES five products the only thing you could not open.
  //
  // It is not a `ProductKey` and it must not become one: `PRODUCT_KEYS` is what
  // the catalogue, the bands and `buildProductCards` iterate, and a membership
  // in that array would be a product with a price, a state and a Soon note it
  // can never have. A sentinel beside the union says the same thing without
  // lying to any of those readers.
  const selected: ProductKey | typeof MEMBERSHIP =
    chosenKey === MEMBERSHIP
      ? MEMBERSHIP
      : cards.some((c) => c.key === chosenKey)
        ? (chosenKey as ProductKey)
        : MEMBERSHIP;
  const card = cards.find((c) => c.key === selected) ?? null;
  const open = chosenKey !== null;

  const line = membershipLine(place);

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
            {/* NO CARD AROUND THE ROWS (MESITA-1982). The two halves are told
                apart by their GROUND now — the index is the grey, the work
                surface is the white — so a white card floating on the grey
                would be a third surface saying a thing the divide already
                says. Hairlines between rows, nothing around them. */}
            <div className="border-border divide-border divide-y border-y">
                {/* MESITA PARTNERSHIP, AS A PRODUCT SOLUTION (MESITA-1982).
                    Pato put it in the list *"almost as a product solution"*
                    and then went further: it IS one. So it takes the first
                    slot of Running with the same row shape, the same mark
                    column and the same badge, rather than a band of its own
                    that said it was a different kind of thing.
                    
                    IT IS STILL NOT A `ProductKey`. `PRODUCT_KEYS` is what the
                    catalogue, the bands and `buildProductCards` iterate, and a
                    partnership in that array is a product with a Soon note and
                    a per-place dial it can never have. The sentinel keeps the
                    row in the list and out of the contract. */}
                {group.title === RUNNING_TITLE && (
                  <Link
                    href={`?p=${MEMBERSHIP}`}
                    scroll={false}
                    aria-current={selected === MEMBERSHIP ? "true" : undefined}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 px-4 py-3.5 text-left transition",
                      selected === MEMBERSHIP ? "bg-card" : "hover:bg-card/60",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        SCOPE_CHIP_CLASS,
                        "bg-muted text-foreground flex shrink-0 items-center justify-center",
                      )}
                    >
                      <span className="text-[22px] leading-none">{"\u{1F91D}"}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-display text-[15px] font-semibold tracking-tight">
                        Mesita Partnership
                      </span>
                      <span className="text-muted-foreground text-[13px] leading-snug">
                        What this place pays for, and what five of the products
                        below are behind.
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <Badge tone={place.partnered ? "gold" : "off"}>
                        {place.partnered ? "Partner" : "Off"}
                      </Badge>
                      <ArrowRight className="text-muted-foreground h-4 w-4" aria-hidden />
                    </span>
                  </Link>
                )}
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
                      {/* THE BLURB, NEVER THE NOTE (MESITA-1982). Pato: *"at
                          the left in the subtitle don't mention the state, just
                          a description of what the product does"*.
                          
                          The note is the product's STATE in a sentence — "On
                          here", "Included with Mesita Partner", "Nothing is
                          built yet" — and the badge at the right end of this
                          same row already carries that fact. Two signals for
                          one fact is how a list ends up read as neither: the
                          eye stops trusting the badge and starts reading nine
                          sentences to find out what is on. The note is still
                          the pane's job, where there is room to say what the
                          state MEANS. */}
                      {/* ONE LINE, CLAMPED (MESITA-1983). The blurbs are
                          sentences — they were written to introduce a product,
                          not to label a row — so at 470px they wrapped to two
                          and three lines and every row became a different
                          height. A list you scan has one rhythm; a list of
                          eighteen paragraphs is prose with icons. The full
                          sentence is on the pane, where it has room. */}
                      <span className="text-muted-foreground line-clamp-1 text-[13px] leading-snug">
                        {card.blurb}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <ProductStateBadge state={card.state} />
                      {/* EVERY ROW OPENS, SO EVERY ROW GETS THE CHEVRON
                          (MESITA-1983). It used to draw only where `open` was
                          set — a product with a SCREEN — which stopped being
                          the question the moment every row got a pane. Half
                          the rows carrying an arrow and half carrying a
                          same-sized blank reads as a list where some entries
                          are broken. */}
                      {card.state === "locked" ? (
                        <Lock
                          className="text-muted-foreground h-4 w-4"
                          aria-label="Needs the partnership"
                        />
                      ) : (
                        <ArrowRight
                          className="text-muted-foreground h-4 w-4"
                          aria-hidden
                        />
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
                      chosen ? "bg-card" : "hover:bg-card/60",
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

      {/* TWO GROUNDS, ONE DIVIDE (MESITA-1982). Pato: *"left and right divide,
          different backgrounds"*.
          
          The halves used to be two columns on one page, told apart only by a
          gap — which is the weakest separator there is, and at 1440px it read
          as a list that happened to have something beside it. They are
          SURFACES now: the index is the page's own grey and the work surface
          is white, with a hairline between them.
          
          IT BLEEDS. `SHELL_BLEED` cancels the shell's gutter so the divide
          runs edge to edge and each half re-applies `SHELL_GUTTER` inside
          itself. A split that stops 32px short of the window is a card with a
          line down it.
          
          `min-h` IN `vh` rather than `h-full`: this page is inside `main`,
          which is the only scroller, so a percentage height here has no
          definite parent to resolve against — the exact chain that has
          rendered an empty box before. */}
      {/* ONE THIRD, TWO THIRDS, AND TWO SCROLLERS (MESITA-1984). Pato:
          *"better make the left part 1/3 and the other 2/3, lets optimize the
          space a bit"* and *"two different scrollable boxes the left and the
          right"*.
          
          THE HALVES WERE NEVER EQUAL WORK. The left is eighteen rows of a name
          and one clamped line; the right holds Profile's whole form, a menu of
          eight dishes at three prices, a visits table. Splitting a 1440px
          window down the middle gave the index 230px it could not use and the
          work surface 230px it needed.
          
          AND EACH HALF SCROLLS ITSELF, which reverses MESITA-1982's "the page
          is the only scroller". The grid takes a DEFINITE height in `vh` —
          from the viewport, never a percentage of a parent — so each column can
          own an `overflow-y-auto` without the height chain this app has
          already broken once. Scrolling a long product page no longer carries
          the list off the top of the screen. */}
      <div
        className={cn(
          SHELL_BLEED,
          "border-border grid border-t lg:h-[calc(100vh-11.5rem)] lg:grid-cols-3",
        )}
      >
        {/* THE INDEX — the page's own grey, so it reads as the ground the work
            sits beside rather than as a panel laid on it. */}
        <div
          className={cn(
            "border-border lg:border-r",
            open ? "hidden lg:block" : "block",
          )}
        >
          <div
            className={cn(
              SHELL_GUTTER,
              "flex flex-col gap-4 py-4 lg:sticky lg:top-0 lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto",
            )}
          >
            {list}
          </div>
        </div>

        {/* THE WORK SURFACE — white, and the only thing on this screen that
            scrolls with the page. */}
        <div
          className={cn(
            "bg-card",
            SHELL_GUTTER,
            "py-4 lg:col-span-2 lg:min-h-0 lg:overflow-y-auto",
            open ? "block" : "hidden lg:block",
          )}
        >
          {selected === MEMBERSHIP ? (
            <MembershipPane place={place} line={line} />
          ) : card ? (
            <ProductPane card={card} />
          ) : null}
        </div>
      </div>
    </>
  );
}

/** THE PARTNERSHIP, OPENED (MESITA-1982). What the full-width card above the
 *  list used to assert, plus the gate it never carried: `PartnerBanner` is the
 *  purchase decision, and it belongs on the screen the row opens rather than
 *  over a list it is only sometimes about. */
function MembershipPane({
  place,
  line,
}: {
  place: MockPlace;
  line: { lead: string; rest: string };
}) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="?"
        scroll={false}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[13px] font-medium lg:hidden"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All products
      </Link>

      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            SCOPE_CHIP_CLASS,
            "bg-muted text-foreground flex shrink-0 items-center justify-center",
          )}
        >
          <span className="text-[22px] leading-none">{"\u{1F91D}"}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Mesita Partnership
            </h2>
            <Badge tone={place.partnered ? "gold" : "off"}>
              {place.partnered ? "Partner" : "Not a partner"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-[13px] leading-snug">
            <span className="text-foreground font-medium">{line.lead}</span>{" "}
            {line.rest}
          </p>
        </div>
      </div>

      <PartnerBanner place={place} />
    </div>
  );
}
