"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { SaveBar, Toggle, useMockSave } from "@/components/controls";
import { Card, Chip, Note, Section } from "@/components/ui";
import { tipPercents } from "@/lib/mock";
import { cn } from "@/lib/utils";

const tipOptions = [5, 10, 12, 15, 18, 20, 25];

export function PaymentSettingsForm() {
  const s = useMockSave();
  const [tipsOn, setTipsOn] = useState(true);
  const [tips, setTips] = useState<number[]>(tipPercents);

  const flip = (n: number) => {
    setTips((t) => (t.includes(n) ? t.filter((x) => x !== n) : [...t, n].sort((a, b) => a - b).slice(-3)));
    s.touch();
  };

  return (
    <>
      <Section title="Stripe">
        <Card className="flex items-start gap-3 p-4">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Connected · Stripe Express</div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              You are the merchant on every payment and pay Stripe&apos;s fees directly. Stripe checks your documents; Mesita never sees them.
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              <Chip>Cards</Chip>
              <Chip>Apple Pay</Chip>
              <Chip>Google Pay</Chip>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Tips">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium">Ask guests for a tip</div>
              <div className="text-sm text-muted-foreground">Taken on the bill before rewards, so staff never lose tips to a discount.</div>
            </div>
            <Toggle
              label="Tips"
              checked={tipsOn}
              onChange={(v) => {
                setTipsOn(v);
                s.touch();
              }}
            />
          </div>
          {tipsOn ? (
            <>
              <div className="mt-4 text-sm font-medium">Suggested (pick 3)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {tipOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={tips.includes(n)}
                    onClick={() => flip(n)}
                    className={cn(
                      "tabular h-10 min-w-14 rounded-full border px-3 text-sm font-medium",
                      tips.includes(n) ? "border-primary bg-brand-soft text-brand-text" : "border-border bg-card",
                    )}
                  >
                    {n}%
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </Card>
        <Note>Guests can always type their own amount or choose no tip.</Note>
      </Section>
      <SaveBar dirty={s.dirty} saved={s.saved} onSave={s.save} />
    </>
  );
}
