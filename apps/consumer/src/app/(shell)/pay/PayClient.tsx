"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MyQrCard } from "@/components/consumer/MyQrCard";
import { CashbackBalanceCard } from "@/components/consumer/CashbackBalanceCard";
import { ActivityFeed } from "./ActivityFeed";

// Two-tab Pay surface:
//   QR        — your code to show the waiter + cashback balance below.
//   Activity  — your rewards/redemptions log (earns, redemptions, and any
//               story still pending verification), like the old coupons wallet.
type Tab = "qr" | "activity";

const TABS: { id: Tab; label: string }[] = [
  { id: "qr", label: "QR" },
  { id: "activity", label: "Activity" },
];

export function PayClient({
  code,
  cashbackBalanceCents,
}: {
  code: string;
  cashbackBalanceCents: number;
}) {
  const [tab, setTab] = useState<Tab>("qr");
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4">
        <div className="border-border bg-card grid grid-cols-2 gap-0 rounded-full border p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full px-1 py-1.5 text-center text-[12px] font-medium transition",
                tab === t.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-6">
        {tab === "qr" ? (
          <div className="flex flex-col gap-4">
            <MyQrCard code={code} />
            <CashbackBalanceCard cashbackBalanceCents={cashbackBalanceCents} />
          </div>
        ) : (
          <ActivityFeed />
        )}
      </div>
    </div>
  );
}
