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
    <div
      className={cn(
        "bg-card border-border flex w-full items-stretch gap-2 rounded-2xl border p-2",
      )}
      data-wallet-row
      data-place-id={placeId}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={disabled ? `${name}. ${subtitle ?? "Ask Mesita support to use it."}` : `${name}${amount ? `, ${amount}` : ""}`}
        onClick={() => {
          if (!disabled) onOpen?.();
        }}
        className={cn("flex min-w-0 flex-1 basis-0 flex-col justify-center gap-1 px-1 text-left", disabled && "cursor-default opacity-60")}
        data-loyalty-card
      >
        <span className="flex min-w-0 items-center gap-2">
          <MiniCard photo={photo} name={name} />
          <span className="text-foreground min-w-0 truncate text-sm font-semibold">{name}</span>
        </span>
        {subtitle ? (
          <span className="text-muted-foreground block truncate text-sm">{subtitle}</span>
        ) : amount ? (
          <span className="text-foreground block text-lg leading-tight font-bold tabular-nums">{amount}</span>
        ) : distance ? (
          <span className="text-muted-foreground block text-sm">{distance} away</span>
        ) : null}
      </button>
      {slides.length > 0 && placeHref ? (
        // THE WORD AT THE RIGHT (Pato, MESITA-4525: "put the offers thing at
        // the right, not the left"): the place screen's tile, reversed here
        // only, so the moving offer sits next to the card and "Offers"
        // closes the row. The place screen keeps its own order.
        <div className="flex min-w-0 flex-1 basis-0 [&>button]:h-full [&>button]:min-h-14 [&>button]:w-full [&>button]:flex-row-reverse [&>button]:rounded-xl">
          <OffersTile name={name} slides={slides} open={() => () => navigateTo(router, placeHref, { motion: "drill" })} />
        </div>
      ) : (
        <span className="min-w-0 flex-1 basis-0" aria-hidden />
      )}
    </div>
  );
}

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
