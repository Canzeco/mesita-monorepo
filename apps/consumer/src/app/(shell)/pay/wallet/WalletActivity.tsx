"use client";

import { Plus } from "lucide-react";
import { TRANSACTIONS, venueById } from "@/lib/consumer-data";
import { cn } from "@/lib/utils";

// Mock activity feed. The cashback balance above is real (from the
// consumer-profile EF); the transactions list still mirrors the values
// that lived under Profile › Balance until the real activity EF ships.
export function WalletActivity() {
  return (
    <section className="border-border bg-card rounded-2xl border p-5">
      <p className="bg-secondary/10 text-secondary mb-4 rounded-xl px-3 py-2 text-[11px]">
        Preview — activity below is mock until the wallet feed EF lands.
      </p>

      <button
        type="button"
        className="border-border bg-background hover:bg-muted inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition"
      >
        <Plus className="h-4 w-4" />
        Add credits
      </button>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
            Activity
          </p>
          <button
            type="button"
            className="text-secondary text-[12px] font-semibold"
          >
            See all
          </button>
        </div>
        <div className="divide-border mt-2 divide-y">
          {TRANSACTIONS.map((t) => {
            const v = venueById(t.venueId);
            if (!v) return null;
            const positive = t.amount > 0;
            return (
              <div key={t.id} className="flex items-center gap-3 py-3">
                <span className="text-2xl">{v.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{v.name}</p>
                  <p className="text-muted-foreground text-[11px]">
                    {t.when}
                    {t.expires && ` · expires in ${t.expires}`}
                  </p>
                </div>
                <p
                  className={cn(
                    "font-display text-lg font-bold tabular-nums",
                    positive ? "text-secondary" : "text-foreground",
                  )}
                >
                  {positive ? "+" : "−"}${Math.abs(t.amount).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
