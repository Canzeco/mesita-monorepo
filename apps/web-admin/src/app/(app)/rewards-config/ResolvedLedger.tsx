"use client";

import { useState } from "react";

import {
  CLASS_KEYS,
  CLASS_META,
  PLAN_KEYS,
  PLAN_META,
  STRATEGY_KEYS,
  STRATEGY_META,
  type ClassKey,
  type PlanKey,
  type PromosConfig,
  type StrategyKey,
} from "./promos";

// THE LEDGER. Splitting the grid into components removed every visible total:
// no box answers "what does a Diamond on Premium actually pay here?". A single
// hardcoded example under-serves a model where nothing else shows a sum, so
// the operator picks the guest and watches the arithmetic.
//
// It shows dashes, never 0%, when a term does not apply — zero is a real rate
// and would misreport as one.

type Picked = {
  strategy: StrategyKey;
  cls: ClassKey;
  plan: PlanKey;
  firstVisit: boolean;
  story: boolean;
  mesita: boolean;
  google: boolean;
};

const CHIP =
  "rounded-md px-2 py-0.5 type-label font-semibold transition border";
// On the dark ledger surface the "selected" state inverts to the page
// background, so the chip states are written inline rather than as shared
// light-surface constants.
const CHIP_ON = "bg-background text-foreground border-transparent";
const CHIP_OFF = "border-white/25 text-white/70 hover:text-white";

export function ResolvedLedger({ cfg }: { cfg: PromosConfig }) {
  const [p, setP] = useState<Picked>({
    strategy: "aggressive",
    cls: "diamond",
    plan: "premium",
    firstVisit: true,
    story: true,
    mesita: false,
    google: false,
  });

  const b = cfg.visits.bonuses[p.strategy];
  const base = cfg.visits.base[p.strategy].bronze.free;
  const classAdds = cfg.visits.base[p.strategy][p.cls].free - base;
  const planAdds = cfg.visits.base[p.strategy].bronze.premium - base;

  const terms: { label: string; value: number | null }[] = [
    { label: "Base", value: base },
    {
      label: `Class · ${CLASS_META[p.cls].name}`,
      value: classAdds > 0 ? classAdds : null,
    },
    {
      label: `Plan · ${PLAN_META[p.plan].name}`,
      value: p.plan === "premium" && planAdds > 0 ? planAdds : null,
    },
    { label: "Welcome", value: p.firstVisit ? b.welcome : null },
    { label: "Instagram Story", value: p.story ? b.story : null },
    { label: "Mesita Review", value: p.mesita ? b.mesita : null },
    { label: "Google Review", value: p.google ? b.google : null },
  ];

  const total = Math.min(
    100,
    terms.reduce((sum, t) => sum + (t.value ?? 0), 0),
  );

  return (
    <section className="bg-foreground text-background rounded-2xl p-4 sm:p-5">
      <p className="type-meta font-bold tracking-[0.14em] uppercase opacity-60">
        Resolved — pick a guest
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {STRATEGY_KEYS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={p.strategy === s}
            onClick={() => setP((v) => ({ ...v, strategy: s }))}
            className={`${CHIP} ${p.strategy === s ? CHIP_ON : CHIP_OFF}`}
          >
            {STRATEGY_META[s].emoji} {STRATEGY_META[s].name}
          </button>
        ))}
        <span className="mx-1 opacity-30">·</span>
        {CLASS_KEYS.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={p.cls === c}
            onClick={() => setP((v) => ({ ...v, cls: c }))}
            className={`${CHIP} ${p.cls === c ? CHIP_ON : CHIP_OFF}`}
          >
            {CLASS_META[c].emoji} {CLASS_META[c].name}
          </button>
        ))}
        <span className="mx-1 opacity-30">·</span>
        {PLAN_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={p.plan === k}
            onClick={() => setP((v) => ({ ...v, plan: k }))}
            className={`${CHIP} ${p.plan === k ? CHIP_ON : CHIP_OFF}`}
          >
            {PLAN_META[k].name}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {(
          [
            ["firstVisit", "First visit"],
            ["story", "Story"],
            ["mesita", "Mesita review"],
            ["google", "Google review"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={p[key]}
            onClick={() => setP((v) => ({ ...v, [key]: !v[key] }))}
            className={`${CHIP} ${p[key] ? CHIP_ON : CHIP_OFF}`}
          >
            {p[key] ? "✓ " : ""}
            {label}
          </button>
        ))}
      </div>

      <dl className="mt-3.5 border-t border-white/20 pt-2.5">
        {terms.map((t) => (
          <div
            key={t.label}
            className="flex items-baseline justify-between py-[3px] type-body"
          >
            <dt className={t.value == null ? "opacity-40" : "opacity-85"}>
              {t.label}
            </dt>
            <dd className="font-mono tabular-nums">
              {t.value == null ? (
                <span className="opacity-40">—</span>
              ) : (
                `${t.label === "Base" ? "" : "+"}${t.value}%`
              )}
            </dd>
          </div>
        ))}
        <div className="mt-1.5 flex items-baseline justify-between border-t border-white/20 pt-2 text-sm font-bold">
          <dt>Pays</dt>
          <dd className="font-mono tabular-nums">
            {total}%{" "}
            <span className="type-label font-medium opacity-60">
              · first MX${cfg.cap.toLocaleString("en-US")}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
