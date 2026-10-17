import type { SignalPreviewCurvePoint, SignalPreviewRow } from "./actions";

// The drawing half of the Signals graphics. Pure: rows and points in, marks
// out. Every number arrives from admin-web-preview-signals.

export function formatScore(score: number): string {
  if (!Number.isFinite(score)) return "—";
  return score.toFixed(2);
}

export function ScoreBars({ rows, ordered = true }: { rows: SignalPreviewRow[]; ordered?: boolean }) {
  const shown = ordered
    ? [...rows].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    : rows;
  return (
    <ol className="flex flex-col gap-2">
      {shown.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{row.label}</span>
            <span className="tabular-nums">{formatScore(row.score)}</span>
          </div>
          <div className="bg-muted mt-1 h-2 overflow-hidden rounded-full">
            <div
              className="bg-foreground h-full rounded-full"
              style={{ width: `${Math.max(0, Math.min(1, row.score)) * 100}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{row.note}</p>
        </li>
      ))}
    </ol>
  );
}

export function MembershipList({ rows }: { rows: SignalPreviewRow[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.label} className="flex items-baseline justify-between gap-3 text-sm">
          <span>
            {row.label}
            <span className="text-muted-foreground ml-2 text-xs">{row.note}</span>
          </span>
          <span className="tabular-nums">{formatScore(row.score)}</span>
        </li>
      ))}
    </ul>
  );
}

// Score (0–1, up) against distance (km, right). The dashed line is Max km.
export function ProximityCurve({
  points,
  maxKm,
}: {
  points: SignalPreviewCurvePoint[];
  maxKm: number;
}) {
  const ordered = [...points].sort((a, b) => a.km - b.km);
  if (ordered.length < 2) return null;
  const spanKm = Math.max(...ordered.map((point) => point.km), 1);
  const width = 320;
  const height = 120;
  const pad = { left: 28, right: 8, top: 8, bottom: 20 };
  const x = (km: number) => pad.left + (km / spanKm) * (width - pad.left - pad.right);
  const y = (score: number) =>
    pad.top + (1 - Math.max(0, Math.min(1, score))) * (height - pad.top - pad.bottom);
  const line = ordered.map((point) => `${x(point.km)},${y(point.score)}`).join(" ");
  const baseline = height - pad.bottom;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-32 w-full"
      role="img"
      aria-label={`Proximity curve: score falls from ${formatScore(ordered[0].score)} at 0 km to ${formatScore(ordered[ordered.length - 1].score)} at ${ordered[ordered.length - 1].km} km. Max km is ${maxKm}.`}
    >
      <line x1={pad.left} x2={width - pad.right} y1={baseline} y2={baseline} className="stroke-border" />
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={baseline} className="stroke-border" />
      <line
        x1={x(maxKm)}
        x2={x(maxKm)}
        y1={pad.top}
        y2={baseline}
        className="stroke-muted-foreground"
        strokeDasharray="3 3"
      />
      <polyline fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" points={line} />
      <text x={pad.left - 4} y={y(1) + 4} textAnchor="end" className="fill-muted-foreground type-meta">1</text>
      <text x={pad.left - 4} y={baseline + 3} textAnchor="end" className="fill-muted-foreground type-meta">0</text>
      <text x={pad.left} y={height - 4} className="fill-muted-foreground type-meta">0 km</text>
      <text x={x(maxKm)} y={height - 4} textAnchor="middle" className="fill-muted-foreground type-meta">
        {maxKm} km
      </text>
    </svg>
  );
}
