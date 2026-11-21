"use client";

import { useRouter } from "next/navigation";
import { OffersTile, offerSlides, SizedImg, type OfferInput } from "@mesita/place-profile";
import { navigateTo } from "@/lib/navigate";
import { cn } from "@/lib/utils";

// A LOYALTY CARD BOX (Pato, 2026-11-21, MESITA-4520: "THE LEFT MUST BE THE
// CARD, WITH THE AMOUNT ON TOP. IT MUST HAVE CARD DIMENSIONS. THE RIGHT REST
// OF SPACE MUST BE THE BOX TO DISPLAY THE OFFERS IN CAROUSEL, BUT IT MUST BE
// A DARK BUTTON SAYING OFFERS ... LIKE THAT BUTTON IN PLACE PROFILE"). Left:
// a card in a bank card's proportions (85.6 x 54 mm), the place's photo,
// the balance on top and the name at the bottom; a tap selects it for the
// page's Pay (nothing is selected until then, MESITA-4519). Right: the place
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
  selected = false,
  disabled = false,
  onSelect,
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
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const router = useRouter();
  const slides = disabled || !placeHref ? [] : offerSlides(offers);
  return (
    <div
      className={cn(
        "bg-card flex w-full items-stretch gap-2 rounded-2xl border p-2",
        selected ? "border-foreground border-2" : "border-border",
      )}
      data-wallet-row
      data-place-id={placeId}
      data-selected={selected ? "true" : undefined}
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={disabled ? undefined : selected}
        aria-label={
          disabled
            ? `${name}. ${subtitle ?? "Ask Mesita support to use it."}`
            : `${selected ? "Selected" : "Select"} ${name}${amount ? `, ${amount}` : ""}`
        }
        onClick={() => {
          if (!disabled && !selected) onSelect?.();
        }}
        className={cn(
          "bg-foreground relative aspect-[85.6/54] w-[46%] shrink-0 overflow-hidden rounded-xl text-left text-white ring-1 ring-black/10",
          disabled && "cursor-default opacity-60",
        )}
        data-loyalty-card
      >
        {photo ? <SizedImg src={photo} size="card" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : null}
        {/* Ink over the photo so the white words read on any picture. */}
        <span className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/70" aria-hidden />
        <span className="relative flex h-full flex-col justify-between p-2.5">
          <span className="block text-lg leading-tight font-bold tabular-nums">{amount ?? ""}</span>
          <span className="block truncate text-sm font-semibold">{name}</span>
        </span>
      </button>
      {slides.length > 0 && placeHref ? (
        <div className="flex min-w-0 flex-1 [&>button]:h-full [&>button]:w-full [&>button]:rounded-xl">
          <OffersTile name={name} slides={slides} open={() => () => navigateTo(router, placeHref, { motion: "drill" })} />
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col justify-center px-1">
          <span className="text-foreground block truncate text-base font-semibold">{name}</span>
          {subtitle ? (
            <span className="text-muted-foreground block truncate text-sm">{subtitle}</span>
          ) : distance ? (
            <span className="text-muted-foreground block text-sm">{distance} away</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
