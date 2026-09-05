// The aggression dial, read-only for the mock era. Continuous 0-100 with
// the four legacy strategy names as LANDMARKS (labels, not stops) and a
// consequence preview line so the knob is never a mystery (Design T2).
// Figures are illustrative until the real shape lands server-side.
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { formatMxn } from "@/lib/model/format";

const LANDMARKS = [
  { at: 0, label: "Zero" },
  { at: 35, label: "Conservative" },
  { at: 65, label: "Aggressive" },
  { at: 90, label: "Dominant" },
];

export function Dial({
  aggression,
  capMxn,
}: {
  aggression: number;
  capMxn: number | null;
}) {
  const headlinePct = Math.min(70, Math.round((aggression * 0.7) / 5) * 5);
  const exampleCost = Math.min(
    Math.round((50_000 * headlinePct) / 100),
    (capMxn ?? 10_000) * 100,
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="relative pt-1 pb-5">
        <div className="bg-muted h-2 w-full rounded-full">
          <div
            className="bg-foreground h-2 rounded-full"
            style={{ width: `${aggression}%` }}
          />
        </div>
        <div
          className="border-background bg-foreground absolute top-0 h-4 w-4 -translate-x-1/2 rounded-full border-2"
          style={{ left: `${aggression}%` }}
        />
        {LANDMARKS.map((m) => (
          <span
            key={m.label}
            className="text-muted-foreground absolute bottom-0 -translate-x-1/2 text-[10px]"
            style={{ left: `${Math.max(4, Math.min(96, m.at))}%` }}
          >
            {m.label}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className={TINY_LABEL_CLASS}>Aggression · {aggression}/100</span>
        <span className="text-muted-foreground text-[12px]">
          {aggression === 0
            ? "Rewards are off."
            : `At this setting a ${formatMxn(50_000)} bill can carry up to ${headlinePct}% off (~${formatMxn(exampleCost)}), capped at ${capMxn ? formatMxn(capMxn * 100) : "no cap"}. Illustrative.`}
        </span>
      </div>
    </div>
  );
}
