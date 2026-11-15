// A saved card's brand, drawn (MESITA-4057, Pato 2026-11-15: "for the saved
// cards, use icons of the card or something, if viable, else just the black.
// but it would be great if at least the color"). Stripe tells us the brand
// key only (visa, mastercard, amex, …), never the card's own art, so a card
// wears its brand's OFFICIAL mark — the Wikimedia Commons files in
// public/marks/card-*.svg (public domain), shipped unchanged (the MESITA-3985
// rule) — on the brand's colour. Visa's blue file is shown white on Visa
// blue by a CSS filter, never redrawn. A brand with no file (Carnet, any
// new key) keeps the black tile with the last four.
//
// One component for every place a saved card shows: the Wallet's Money
// Payment Methods rows, the card's sheet, Pay's card face and card pickers,
// the tab's card picker and the voucher pay sheet.

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Look = {
  src: string;
  /** The tile's colour. */
  bg: string;
  /** A dark tile: text on it is white. */
  dark: boolean;
  /** Visa's blue file shown white (CSS filter). */
  whiten?: boolean;
  /** The file is already a square tile on the same colour (Amex's blue
   *  box): it covers the chip, drawn at 90% so its words clear the edges. */
  bleed?: boolean;
};

const LOOKS: Record<string, Look> = {
  visa: { src: "/marks/card-visa.svg", bg: "#1A1F71", dark: true, whiten: true },
  mastercard: { src: "/marks/card-mastercard.svg", bg: "#252525", dark: true },
  amex: { src: "/marks/card-amex.svg", bg: "#016FD0", dark: true, bleed: true },
  discover: { src: "/marks/card-discover.svg", bg: "#FFFFFF", dark: false },
  jcb: { src: "/marks/card-jcb.svg", bg: "#FFFFFF", dark: false },
  unionpay: { src: "/marks/card-unionpay.svg", bg: "#FFFFFF", dark: false },
  diners: { src: "/marks/card-diners.svg", bg: "#FFFFFF", dark: false },
};

/** The brand's look, or null for the black last-four tile. */
export function cardBrandLook(brand: string): Look | null {
  return LOOKS[brand] ?? null;
}

function BrandImg({ look, className }: { look: Look; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static SVG mark, like CalendarMark's
    <img src={look.src} alt="" draggable={false} className={cn("object-contain", look.whiten && "brightness-0 invert", className)} />
  );
}

/** The chip: a payment card in miniature (1.586:1), the size of the
 *  Wallet's other method chips. */
export function CardBrandChip({ brand, last4, className }: { brand: string; last4: string; className?: string }) {
  const look = cardBrandLook(brand);
  const base = "flex h-8 w-[3.2rem] shrink-0 items-center justify-center overflow-hidden rounded-md";
  if (!look) {
    return (
      <span className={cn(base, "bg-neutral-900 text-[0.625rem] font-semibold text-white tabular-nums", className)} aria-hidden>
        {last4}
      </span>
    );
  }
  return (
    <span
      className={cn(base, !look.dark && "ring-border ring-1 ring-inset", !look.bleed && "px-1.5 py-1", className)}
      style={{ backgroundColor: look.bg }}
      aria-hidden
    >
      <BrandImg look={look} className={look.bleed ? "h-full w-full scale-90 object-cover" : "h-full w-full"} />
    </span>
  );
}

/** A big card face's colours and its mark: the face paints `bg`, writes in
 *  `text`, and shows `mark` where the brand's name was. Unknown brand: the
 *  black face with the brand's name. */
export function cardFace(brand: string, name: string): { style?: CSSProperties; className: string; mark: ReactNode } {
  const look = cardBrandLook(brand);
  if (!look) return { className: "bg-neutral-900 text-white", mark: <span className="text-base font-semibold">{name}</span> };
  return {
    style: { backgroundColor: look.bg },
    className: look.dark ? "text-white" : "text-foreground ring-border ring-1 ring-inset",
    mark: <BrandImg look={look} className={look.bleed ? "-mt-3 -ml-3 h-16 w-16 self-start" : "h-7 w-auto max-w-[45%] self-start"} />,
  };
}
