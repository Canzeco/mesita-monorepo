// The Mesita Partner disc — the mark beside a partner place's name.
//
// It was `VerifiedCheck`, drawn in a hardcoded sky `#0EA5E9`, and it was
// already gated on `promoting` at both call sites: a component named for
// verification, painted a colour from no palette we own, firing on a third
// fact entirely. Three different things wearing one badge.
//
// Now it says one thing: this place is a Mesita Partner.
//
// `currentColor` rather than a literal, so the caller sets the hue from a
// token (`text-primary` = the brand pink) and the disc can never drift from
// the brand the way a pasted hex did. Inlined rather than an <img> because
// SVG optimization is off (see next.config) and this renders on every card.
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
      <circle cx="12" cy="12" r="12" fill="currentColor" />
      <path
        d="M7.2 12.2l3.1 3.1 6.5-6.6"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
