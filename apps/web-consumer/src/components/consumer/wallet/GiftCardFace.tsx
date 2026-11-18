import { SizedImg } from "@mesita/place-profile";

// THE PACKED GIFT CARD (MESITA-4333, Pato: "not sending, but pack them …
// pack credits inside a box, then send the gift to one friend … show a gift
// card or be illustrative"). The mini Loyalty Card's pink face (PlaceCredit,
// MESITA-3802), wrapped: one white ribbon down its right third and one
// across its middle, a bow where they cross. The place's photo and name sit
// above the ribbon, the amount and "Gift Card" under it, clear of the band.

function Bow() {
  return (
    <svg viewBox="0 0 48 32" className="h-8 w-12 drop-shadow-sm" aria-hidden>
      <path d="M24 16 C 14 2, 2 4, 4 14 C 6 22, 16 20, 24 16 Z" fill="white" />
      <path d="M24 16 C 34 2, 46 4, 44 14 C 42 22, 32 20, 24 16 Z" fill="white" />
      <path d="M22 17 L 16 30 L 20 29 L 24 18 Z" fill="white" />
      <path d="M26 17 L 32 30 L 28 29 L 24 18 Z" fill="white" />
      <circle cx="24" cy="16" r="4.5" fill="white" stroke="rgb(0 0 0 / 0.08)" />
    </svg>
  );
}

export function GiftCardFace({
  name,
  photo,
  amount,
}: {
  name: string;
  photo: string | null;
  /** Formatted, "$200.00MX". */
  amount: string;
}) {
  return (
    <div
      role="img"
      aria-label={`Gift card, ${amount} at ${name}`}
      className="relative mx-auto aspect-[1.586] w-3/4 max-w-xs shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--brand-pink-500)] to-[var(--brand-pink-800)] p-4 text-white shadow-lg"
      data-gift-card
    >
      {/* The ribbon: down the right third, across the middle. */}
      <span className="pointer-events-none absolute inset-y-0 right-[22%] w-3.5 bg-white/90" aria-hidden />
      <span className="pointer-events-none absolute inset-x-0 top-[46%] h-3.5 -translate-y-1/2 bg-white/90" aria-hidden />
      <span className="pointer-events-none absolute top-[46%] right-[22%] translate-x-[calc(50%-0.4375rem)] -translate-y-1/2" aria-hidden>
        <Bow />
      </span>
      <div className="relative flex max-w-[66%] items-center gap-1.5" aria-hidden>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white/20 type-label font-semibold">
          {photo ? (
            <SizedImg src={photo} size="thumb" alt="" className="h-full w-full object-cover" />
          ) : (
            (name ?? "?").trim().charAt(0).toUpperCase()
          )}
        </span>
        <span className="line-clamp-2 min-w-0 type-label leading-tight font-semibold">{name}</span>
      </div>
      <div className="absolute bottom-4 left-4" aria-hidden>
        <p className="text-2xl font-semibold tabular-nums">{amount}</p>
        <p className="type-eyebrow text-white/85">Gift Card</p>
      </div>
    </div>
  );
}
