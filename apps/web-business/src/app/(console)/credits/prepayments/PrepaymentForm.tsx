"use client";

import { useState } from "react";
import { SaveBar, Toggle, useMockSave } from "@/components/controls";
import { Card, Note } from "@/components/ui";
import { money } from "@/lib/format";
import { prepayAmounts } from "@/lib/mock";
import { creditsForPrepayment } from "@/lib/rewards";
import { cn } from "@/lib/utils";

export function PrepaymentForm() {
  const s = useMockSave();
  const [selling, setSelling] = useState(true);
  const [amounts, setAmounts] = useState(prepayAmounts);

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">Sell credit</div>
            <div className="text-sm text-muted-foreground">Needs Payments connected. The bonus is 10% for every place.</div>
          </div>
          <Toggle
            label="Sell credit"
            checked={selling}
            onChange={(v) => {
              setSelling(v);
              s.touch();
            }}
          />
        </div>
        {selling ? (
          <>
            <div className="mt-5 text-sm font-medium">Amounts guests can buy</div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {amounts.map((a) => (
                <button
                  key={a.amount}
                  type="button"
                  aria-pressed={a.enabled}
                  onClick={() => {
                    setAmounts((xs) => xs.map((x) => (x.amount === a.amount ? { ...x, enabled: !x.enabled } : x)));
                    s.touch();
                  }}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    a.enabled ? "border-primary bg-brand-soft" : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <div className="tabular font-semibold">Pay {money(a.amount)}</div>
                  <div className="tabular text-sm">Get {money(creditsForPrepayment(a.amount))}</div>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </Card>
      <Note>You get the money today. The guest spends it on later visits, and comes back to do it.</Note>
      <SaveBar dirty={s.dirty} saved={s.saved} onSave={s.save} />
    </>
  );
}
