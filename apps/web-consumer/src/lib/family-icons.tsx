// The guest's family marks: Microsoft's Fluent Emoji Flat art (MIT), drawn
// from our own files, never the phone's emoji font (Pato, 2026-11-23,
// MESITA-4782: "colors encode information", then chose "A · Fluent Flat"
// over Apple's emoji, Noto, Twemoji, OpenMoji and one-colour icons). The
// same picture on every phone. Fluent has no flags, so Mexican's flag is
// Twemoji's (CC-BY 4.0, Twitter). Files: public/families/<key>.svg.
//
// CONSUMER ONLY. The family list and its emoji (lib/place-families.ts) stay
// the data admin and business show. Home's strip and menu, Search's chips
// and Search's families sheet draw `FamilyMark`.

/** Every row and chip key the guest sees that has its own picture. */
export const FAMILY_MARK_KEYS = [
  "saved",
  "social",
  "near",
  "all",
  "dinner",
  "coffee",
  "drinks",
  "quick_bite",
  "breakfast",
  "mexican",
  "tacos",
  "seafood",
  "asian",
  "european",
  "fancy",
  "steak",
  "japanese",
  "american",
  "healthy",
  "italian",
  "sushi",
  "pizza",
  "burgers",
  "arabic",
  "chinese",
  "indian",
  "chicken",
  "sweet",
  "night_out",
  "bakery",
  "nightclub",
  "music",
  "fun",
  "casino",
] as const;

const KNOWN = new Set<string>(FAMILY_MARK_KEYS);
/** Search calls Home's `near` chip `nearby`. */
const ALIASES: Readonly<Record<string, string>> = { nearby: "near" };
/** A key with no picture of its own wears Dinner's plate. */
export const FALLBACK_FAMILY_MARK = "dinner";

/** The file for a row, chip or family key. */
export function familyMarkSrc(key: string): string {
  const k = ALIASES[key] ?? key;
  return `/families/${KNOWN.has(k) ? k : FALLBACK_FAMILY_MARK}.svg`;
}

/** Draws `name`'s picture. Decorative: the chip's label names it. */
export function FamilyMark({
  name,
  size = 22,
  className,
}: {
  name: string;
  /** Kept for callers; the picture is the same on the chosen ink circle. */
  on?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    // A 1 KB static SVG: next/image would add a request hop for nothing.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={familyMarkSrc(name)}
      alt=""
      aria-hidden
      width={size}
      height={size}
      draggable={false}
      decoding="async"
      className={className}
      style={{ display: "block", width: size, height: size }}
    />
  );
}
