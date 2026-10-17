import type { ReactNode } from "react";
import { Button } from "@/components/admin-ui/config";
import type { SignalPreviewCurvePoint, SignalPreviewRow } from "./actions";

export type SignalCardStatus =
  | "unsaved"
  | "saving"
  | "saved"
  | "validation-error"
  | "backend-error"
  | null;

const STATUS_LABEL: Record<Exclude<SignalCardStatus, null>, string> = {
  unsaved: "Unsaved",
  saving: "Saving",
  saved: "Saved",
  "validation-error": "Validation error",
  "backend-error": "Backend error",
};

export function SignalCard({
  name,
  typeLabel,
  explanation,
  active,
  parameters,
  controls,
  status,
  statusDetail,
  onReset,
  children,
}: {
  name: string;
  typeLabel: string;
  explanation: string;
  active: boolean;
  parameters?: ReactNode;
  controls?: ReactNode;
  status: SignalCardStatus;
  statusDetail?: string | null;
  onReset?: () => void;
  children?: ReactNode;
}) {
  return (
    <article className="border-border bg-background rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{name}</h3>
          <p className="text-muted-foreground mt-1 text-xs font-medium">{typeLabel}</p>
        </div>
        <span className="border-border rounded-full border px-2 py-0.5 text-xs font-medium">
          {active ? "Active" : "Inactive"}
        </span>
      </div>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{explanation}</p>
      {parameters ? <div className="mt-3 text-sm">{parameters}</div> : null}
      {controls ? <div className="mt-3">{controls}</div> : null}
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {onReset ? (
          <Button tone="secondary" size="sm" onClick={onReset}>
            Reset to defaults
          </Button>
        ) : null}
        {status ? (
          <p className="text-muted-foreground text-xs">
            {STATUS_LABEL[status]}
            {statusDetail ? ` — ${statusDetail}` : ""}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function ScoreBars({ rows, ordered = true }: { rows: SignalPreviewRow[]; ordered?: boolean }) {
  const shown = ordered
    ? [...rows].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    : rows;
  return (
    <div className="mt-4 flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {shown.map((row, index) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>
                <span className="text-muted-foreground mr-2 tabular-nums">{index + 1}</span>
                {row.label}
              </span>
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
    </div>
  );
}

export function MembershipList({ rows }: { rows: SignalPreviewRow[] }) {
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.label} className="flex items-baseline justify-between gap-3 text-sm">
          <span>{row.label}</span>
          <span className="text-right">
            <span className="font-medium">{row.note}</span>
            <span className="text-muted-foreground ml-2 tabular-nums">{formatScore(row.score)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ProximityCurve({ points }: { points: SignalPreviewCurvePoint[] }) {
  const ordered = [...points].sort((a, b) => a.km - b.km);
  if (ordered.length < 2) return null;
  const maxKm = Math.max(...ordered.map((point) => point.km), 1);
  const width = 280;
  const height = 88;
  const pad = 8;
  const coords = ordered.map((point) => {
    const x = pad + (point.km / maxKm) * (width - pad * 2);
    const y = pad + (1 - Math.max(0, Math.min(1, point.score))) * (height - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-24 w-full" role="img" aria-label="Proximity curve">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={coords.join(" ")} />
    </svg>
  );
}

export function formatScore(score: number): string {
  if (!Number.isFinite(score)) return "—";
  return score.toFixed(2);
}
