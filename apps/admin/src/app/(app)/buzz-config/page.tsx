import { Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

// Read-only draft — the same constants the Buzz tab computes with
// (manage-single/sections/BuzzSection.tsx). Becomes editable once the model
// ships for real; until then this page is the single place to read the knobs.
const IMPORTANCE_WEIGHTS = [
  { label: "Google stars", value: "≤ 6 pts", hint: "rating / 5 × 6" },
  { label: "Review volume", value: "≤ 3 pts", hint: "log — 5,000 maxes it" },
  { label: "Social proof", value: "≤ 1 pt", hint: "IG followers, log" },
];

const ENGINE_D0 = [
  { label: "Swipe", value: "1.5 km", hint: "most local" },
  { label: "Map", value: "3 km", hint: "mid-range" },
  { label: "Memo", value: "5 km", hint: "meaning first" },
];

export default function BuzzConfigPage() {
  return (
    <section className="border-border bg-card shadow-card rounded-2xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-600">
            <Megaphone className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Model
            </h2>
            <p className="text-muted-foreground mt-0.5 max-w-2xl text-xs leading-relaxed">
              One score per place, spent by all three engines.
            </p>
          </div>
        </div>
        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold">
          Draft — read-only
        </span>
      </div>

      <p className="text-muted-foreground mt-5 font-mono text-xs">
        buzz = (visibility + importance) ÷ (1 + distance/d₀)
      </p>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
            Importance weights · 1–10
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {IMPORTANCE_WEIGHTS.map((k) => (
              <Knob key={k.label} {...k} />
            ))}
          </div>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Visibility (the other 10) is the live Promos score — configured per
            place on its Promos tab.
          </p>
        </div>

        <div>
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
            Engine distance sensitivity · d₀
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ENGINE_D0.map((k) => (
              <Knob key={k.label} {...k} />
            ))}
          </div>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Potency halves every d₀ — each engine has its own appetite for
            distance.
          </p>
        </div>
      </div>
    </section>
  );
}

function Knob({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-muted/60 border-border/60 rounded-xl border px-3 py-2.5 text-center">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="font-display mt-0.5 text-lg font-semibold tracking-tight">
        {value}
      </p>
      <p className="text-muted-foreground text-[11px]">{hint}</p>
    </div>
  );
}
