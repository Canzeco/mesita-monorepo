// The AI mark: a big four-point star and a small one, filled in the ink
// (Pato, MESITA-3991: "don't mention ask ai, just some logo … symbolizing AI.
// keep it easy and clean"). Filled, not stroked, so it reads at a glance;
// currentColor, so it stays in the app's black and white.
const star = (cx: number, cy: number, r: number) => {
  const k = r * 0.22;
  return (
    `M${cx} ${cy - r}` +
    `Q${cx + k} ${cy - k} ${cx + r} ${cy}` +
    `Q${cx + k} ${cy + k} ${cx} ${cy + r}` +
    `Q${cx - k} ${cy + k} ${cx - r} ${cy}` +
    `Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`
  );
};

// A thin round-joined stroke of the same ink softens the four tips.
const D = `${star(10, 10, 8.8)}${star(18.2, 18.2, 4.4)}`;

export function AiSparkle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={D} />
    </svg>
  );
}
