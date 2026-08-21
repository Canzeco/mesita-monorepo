// Mesita Partner disc, inlined so it renders without the next/image
// optimizer (SVG optimization is disabled — see next.config). Mirrors
// public/brand/verified-check.svg. Callers size via className.
export function VerifiedCheck({
  className,
  title = "Mesita reward here",
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
      <circle cx="12" cy="12" r="12" fill="#0EA5E9" />
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
