// The Mesita Partner badge — the mark beside a partner place's name, and the
// icon inside every "Partner" chip.
//
// It was `VerifiedCheck`, drawn in a hardcoded sky `#0EA5E9`, and it was gated
// on `promoting` at both call sites: a component named for verification,
// painted a colour from no palette we own, firing on a third fact entirely.
// Three different things wearing one badge. That was fixed; the SHAPE was not.
//
// What replaced it was a plain filled disc with a check, and then MESITA-1934
// repointed `--primary` to near-black for the achromatic repaint — so the
// partner badge quietly became a BLACK CIRCLE. Nothing failed. It just stopped
// looking like a badge.
//
// decision: Pato (MESITA-2031) — *"FOR PARTNER BADGE USE THE VERIFIED ICON,
// THAT BLUE SHIT FROM TWITTER KINDA, BUT RED."* So: the scalloped rosette the
// whole internet already reads as "verified", in `--partner` red.
//
// The silhouette is EIGHT lobes, not twelve. Twitter's own badge is eight, and
// the count is not cosmetic: at the 14–18px this actually renders at, twelve
// scallops alias into a soft circle and the badge goes back to being a dot.
// Valleys at r=9.5, peaks at 11.9 — the peaks touch the 24-box with 0.1 to
// spare, so nothing clips when a caller sizes it by width.
//
// `currentColor` rather than a literal, so the caller sets the hue from a token
// (`text-partner`) and the fill can never drift the way a pasted hex did.
// The check is `#FFFFFF` and NOT `--partner-foreground`: it is knocked out of
// the fill, so it must stay white even where a caller overrides the colour.
// Inlined rather than an <img> because SVG optimization is off (see
// next.config) and this renders on every card in the deck.
export function PartnerMark({
  className,
  title = "Mesita Partner",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      <path
        d="M12 2.5A3.68 3.68 0 0 1 18.72 5.28A3.68 3.68 0 0 1 21.5 12A3.68 3.68 0 0 1 18.72 18.72A3.68 3.68 0 0 1 12 21.5A3.68 3.68 0 0 1 5.28 18.72A3.68 3.68 0 0 1 2.5 12A3.68 3.68 0 0 1 5.28 5.28A3.68 3.68 0 0 1 12 2.5Z"
        fill="currentColor"
      />
      <path
        d="M7.5 12.3l3 3 6-6.1"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
