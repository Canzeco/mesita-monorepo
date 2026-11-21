"use client";

import { useRouter } from "next/navigation";
import { OffersTile, offerSlides, SizedImg, type OfferInput } from "@mesita/place-profile";
import { navigateTo } from "@/lib/navigate";
import { cn } from "@/lib/utils";

// TWO LINES (Pato, 2026-11-21, MESITA-4525: "optimize space in that card,
// make them shorter … card profile picture, name | Offers / amount |
// Offers"): a 40x26 card cut from the place's photo and the name, the
// amount under them (or the distance), the Offers tile beside both lines,
// about 72px tall, split half and half (Pato: "LEFT MUST BE 50% AND RIGHT
// MUST BE 50%"; an empty half holds the place when there are no offers).
// The bank-card-sized card below was ~130px.
//
// A LOYALTY CARD BOX (Pato, 2026-11-21, MESITA-4520: "THE LEFT MUST BE THE
// CARD, WITH THE AMOUNT ON TOP. IT MUST HAVE CARD DIMENSIONS. THE RIGHT REST
// OF SPACE MUST BE THE BOX TO DISPLAY THE OFFERS IN CAROUSEL, BUT IT MUST BE
// A DARK BUTTON SAYING OFFERS ... LIKE THAT BUTTON IN PLACE PROFILE"). Left:
// a card in a bank card's proportions (85.6 x 54 mm), the place's photo,
// the balance on top and the name at the bottom; a tap opens its Loyalty
// Card (MESITA-4523: Pay Bill asks for the place in its sheet, so nothing
// is selected here; a tap selected it for Pay in MESITA-4519). Right: the place
// screen's own Offers tile (OffersTile, black with the moving chip), which
// opens the place. No offers: the name and distance in plain text there.
// MESITA-4519's two halves (photo and name over a mini card) before.

export function PlaceActionRow({
  name,
  photo = null,
  amount,
  distance = null,
  subtitle,
  offers = null,
  placeHref,
  placeId,
  disabled = false,
  onOpen,
}: {
  name: string;
  /** The place picture. A missing one leaves the card black with the initial. */
  photo?: string | null;
  /** Plain amount. Absent when they hold nothing here. */
  amount?: string | null;
  /** "350 m" when the place is located. */
  distance?: string | null;
  subtitle?: string | null;
  /** What the guest can buy here now; none shows the name instead of Offers. */
  offers?: OfferInput | null;
  /** The place page the Offers tile opens. */
  placeHref?: string;
  placeId?: string;
  disabled?: boolean;
  /** The card's tap: its Loyalty Card page (or the place). */
  onOpen?: () => void;
}) {
  const router = useRouter();
  const slides = disabled || !placeHref ? [] : offerSlides(offers);
  return (
    // A 2x2 GRID (Pato, 2026-11-21, MESITA-4531: "card-name inside a box,
    // then current balance inside a button box, 50% tall … 50% wide,
    // occupying left side": "Card & Name | Offers / Balance | Offers"): two
    // bordered 48px boxes in the left half, the Offers tile the whole right
    // half. Both left boxes open the Loyalty Card. Two loose lines before.
    <div className="bg-card border-border grid w-full grid-cols-2 grid-rows-[3rem_3rem] gap-2 rounded-2xl border p-2" data-wallet-row data-place-id={placeId}>
      <button
        type="button"
        disabled={disabled}
        aria-label={disabled ? `${name}. ${subtitle ?? "Ask Mesita support to use it."}` : name}
        onClick={() => {
          if (!disabled) onOpen?.();
        }}
        className={cn(BOX, disabled && "cursor-default opacity-60")}
        data-loyalty-card
      >
        <MiniCard photo={photo} name={name} />
        {/* Two lines before it cuts (MESITA-4532): "Taquería Orinoco (TEC)"
            fits at 390px. */}
        <span className="text-foreground line-clamp-2 min-w-0 text-sm leading-tight font-semibold">{name}</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label={subtitle ?? (amount ? `Balance at ${name}: ${amount}` : distance ? `${name}, ${distance} away` : name)}
        onClick={() => {
          if (!disabled) onOpen?.();
        }}
        className={cn(BOX, "col-start-1 row-start-2", disabled && "cursor-default opacity-60")}
        data-loyalty-balance
      >
        {subtitle ? (
          <span className="text-muted-foreground min-w-0 truncate text-sm">{subtitle}</span>
        ) : amount ? (
          <span className="text-foreground min-w-0 truncate text-lg leading-tight font-bold tabular-nums">{amount}</span>
        ) : distance ? (
          <span className="text-muted-foreground text-sm">{distance} away</span>
        ) : (
          <span className="text-muted-foreground text-sm">No credit yet</span>
        )}
      </button>
      {slides.length > 0 && placeHref ? (
        // "OFFERS" ON TOP (Pato, 2026-11-21, MESITA-4532: "it must say offers
        // on the bottom or on the top, not on the right"): the place screen's
        // tile turned to a column here only, the glyph and the word in one
        // row across the top, the moving offer filling the rest. At the right
        // (MESITA-4525) before; the place screen keeps its own order.
        <div className="col-start-2 row-span-2 row-start-1 flex min-w-0 [&>button]:h-full [&>button]:w-full [&>button]:flex-col [&>button]:rounded-xl [&>button>span:first-child]:h-6 [&>button>span:first-child]:w-full [&>button>span:first-child]:flex-row [&>button>span:first-child]:gap-1.5">
          <OffersTile name={name} slides={slides} open={() => () => navigateTo(router, placeHref, { motion: "drill" })} />
        </div>
      ) : null}
    </div>
  );
}

/** One left box (MESITA-4531): a 1px hairline box, 48px, the Me tiles' radius. */
const BOX = "border-border bg-card hover:bg-muted/60 flex min-w-0 items-center gap-2 rounded-xl border px-3 text-left transition-colors";

/** The Loyalty Card's face, small (MESITA-4525): 40x26, the place's photo. */
function MiniCard({ photo, name }: { photo: string | null; name: string }) {
  return (
    <span className="bg-foreground relative h-[26px] w-10 shrink-0 overflow-hidden rounded-[5px] ring-1 ring-black/10" aria-hidden>
      {photo ? (
        <SizedImg src={photo} size="thumb" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="text-background type-meta flex h-full w-full items-center justify-center font-bold">
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
