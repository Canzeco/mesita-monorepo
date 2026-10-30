"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Field, SaveBar, Segmented, Toggle, inputClass, useMockSave } from "@/components/controls";
import { Card, Line, Note, Section } from "@/components/ui";
import { money } from "@/lib/format";
import { rewardCap, rewardRules } from "@/lib/mock";
import { MAX_REWARDS_PER_VISIT, rewardsForVisit, type RewardMode, type RewardRule } from "@/lib/rewards";
import { cn } from "@/lib/utils";

const STEP = 5;

export function RewardSettingsForm() {
  const s = useMockSave();
  const [rules, setRules] = useState<RewardRule[]>(rewardRules);
  const [cap, setCap] = useState(rewardCap);

  const update = (id: RewardRule["id"], patch: Partial<RewardRule>) => {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    s.touch();
  };

  // Worst case on a typical bill, so the owner sees what a setting costs.
  const sampleBill = 1500;
  const worst = rewardsForVisit(sampleBill, rules.map((r) => r.id), rules, { cap });

  return (
    <>
      <div className="grid gap-3">
        {rules.map((r) => (
          <Card key={r.id} className={cn("p-4", !r.enabled && "bg-muted/50")}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium">{r.name}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">{r.requirement}</div>
              </div>
              <Toggle label={`${r.name} on`} checked={r.enabled} onChange={(v) => update(r.id, { enabled: v })} />
            </div>
            {r.enabled ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2" role="group" aria-label={`${r.name} percent`}>
                  <button
                    type="button"
                    aria-label="Less"
                    className="grid size-9 place-items-center rounded-full border border-border bg-card hover:bg-muted"
                    onClick={() => update(r.id, { percent: Math.max(STEP, r.percent - STEP) })}
                  >
                    <Minus className="size-4" aria-hidden />
                  </button>
                  <span className="tabular w-12 text-center text-lg font-semibold">{r.percent}%</span>
                  <button
                    type="button"
                    aria-label="More"
                    className="grid size-9 place-items-center rounded-full border border-border bg-card hover:bg-muted"
                    onClick={() => update(r.id, { percent: Math.min(50, r.percent + STEP) })}
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
                <Segmented<RewardMode>
                  label={`${r.name} type`}
                  value={r.mode}
                  onChange={(m) => update(r.id, { mode: m })}
                  options={[
                    { value: "discount", label: "Discount" },
                    { value: "cashback", label: "Cashback" },
                  ]}
                />
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      <Section title="Limits">
        <Card className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Most off one visit" hint="Discount and cashback together, in pesos.">
            <input
              className={inputClass}
              inputMode="numeric"
              value={String(cap)}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ""));
                setCap(Number.isFinite(n) ? n : 0);
                s.touch();
              }}
            />
          </Field>
          <div>
            <span className="text-sm font-medium">Rewards per visit</span>
            <div className="mt-1.5 flex h-11 items-center rounded-lg bg-muted px-3 text-sm">
              {MAX_REWARDS_PER_VISIT}, the guest picks which
            </div>
            <span className="mt-1 block text-xs text-muted-foreground">Same for every place.</span>
          </div>
        </Card>
        <Card className="mt-3 p-4">
          <div className="text-sm font-medium">Most a {money(sampleBill)} bill can cost you</div>
          {worst.applied.map((a) => (
            <Line
              key={a.id}
              muted
              label={rules.find((r) => r.id === a.id)!.name}
              value={`${money(a.amount)}${a.capped ? " (capped)" : ""}`}
            />
          ))}
          <Line label="Total" value={money(worst.total)} strong />
        </Card>
        <Note>Instagram stories need a public account with 1,000+ followers. Loyalty counts verified visits; every 7th earns it.</Note>
      </Section>
      <SaveBar dirty={s.dirty} saved={s.saved} onSave={s.save} />
    </>
  );
}
