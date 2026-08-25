"use client";

import { useState } from "react";

import { Calculator } from "lucide-react";

import { SectionCard } from "@/components/admin-ui/config";
import {
  CLASS_KEYS,
  CLASS_META,
  PLAN_KEYS,
  PLAN_META,
  LIVE_STRATEGY_KEYS,
  STRATEGY_META,
  type ClassKey,
  type PlanKey,
  type PromosConfig,
  type StrategyKey,
} from "./promos";

// THE LEDGER. Component boxes never show a sum, so the operator picks a guest
// and watches the arithmetic. Dashes, never 0%, when a term does not apply.

type Picked = {
  strategy: StrategyKey;
  cls: ClassKey;
  plan: PlanKey;
  firstVisit: boolean;
  story: boolean;
  mesita: boolean;
  google: boolean;
};

const CHIP = "rounded-md px-2 py-0.5 type-label font-semibold transition border";
const CHIP_ON = "bg-foreground text-background border-transparent";
const CHIP_OFF =
  "border-border text-muted-foreground hover:text-foreground hover:bg-muted";

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
  const planAdds =
    cfg.visits.base[p.strategy][p.cls].premium -
    cfg.visits.base[p.strategy][p.cls].free;

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
    { label: "Google Review", value: p.google ? b.google : null },
    { label: "Mesita Review", value: p.mesita ? b.mesita : null },
  ];

  const total = Math.min(
    100,
    terms.reduce((sum, t) => sum + (t.value ?? 0), 0),
  );

  return (
    <SectionCard
      icon={<Calculator className="text-secondary h-4 w-4" />}
      title="Calculator"
      subtitle="Pick a guest. The visit bill adds up. Not orders, not prepaid."
    >
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {LIVE_STRATEGY_KEYS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={p.strategy === s}
            onClick={() => setP((v) => ({ ...v, strategy: s }))}
            className={`${CHIP} ${p.strategy === s ? CHIP_ON : CHIP_OFF}`}
          >
            {STRATEGY_META[s].name}
          </button>
        ))}
        <span className="text-muted-foreground mx-1">·</span>
        {CLASS_KEYS.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={p.cls === c}
            onClick={() => setP((v) => ({ ...v, cls: c }))}
            className={`${CHIP} ${p.cls === c ? CHIP_ON : CHIP_OFF}`}
          >
            {CLASS_META[c].name}
          </button>
        ))}
        <span className="text-muted-foreground mx-1">·</span>
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
            ["firstVisit", "Welcome"],
            ["story", "Instagram Story"],
            ["google", "Google Review"],
            ["mesita", "Mesita Review"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={p[key]}
            onClick={() => setP((v) => ({ ...v, [key]: !v[key] }))}
            className={`${CHIP} ${p[key] ? CHIP_ON : CHIP_OFF}`}
          >
            {label}
          </button>
        ))}
      </div>

      <dl className="border-border mt-3.5 border-t pt-2.5">
        {terms.map((t) => (
          <div
            key={t.label}
            className="flex items-baseline justify-between py-[3px] type-body"
          >
            <dt
              className={
                t.value == null ? "text-muted-foreground" : "text-foreground"
              }
            >
              {t.label}
            </dt>
            <dd className="font-mono tabular-nums">
              {t.value == null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                `${t.label === "Base" ? "" : "+"}${t.value}%`
              )}
            </dd>
          </div>
        ))}
        <div className="border-border mt-1.5 flex items-baseline justify-between border-t pt-2 text-sm font-bold">
          <dt>Pays</dt>
          <dd className="font-mono tabular-nums">
            {total}%{" "}
            <span className="text-muted-foreground type-label font-medium">
              · first {cfg.cap.toLocaleString("en-US")}
            </span>
          </dd>
        </div>
      </dl>
    </SectionCard>
  );
}
