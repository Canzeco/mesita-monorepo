"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MyQrCard } from "@/components/consumer/MyQrCard";
import { CashbackBalanceCard } from "@/components/consumer/CashbackBalanceCard";
import { ActivityFeed } from "./ActivityFeed";
import { PayTickets } from "@/components/consumer/PayTickets";

// Pay surface:
//   QR and Tickets — show QR to waiter, cashback, and active tickets (pay + review steps).
//   Activity       — rewards / redemptions history.
type Tab = "qr_tickets" | "activity";

const TABS: { id: Tab; label: string }[] = [
  { id: "qr_tickets", label: "QR and Tickets" },
  { id: "activity", label: "Activity" },
];

export function PayClient({
  userId,
  code,
  cashbackBalanceCents,
}: {
  userId: string;
  code: string;
  cashbackBalanceCents: number;
}) {
  const [tab, setTab] = useState<Tab>("qr_tickets");
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
                "rounded-full px-1 py-1.5 text-center text-[11px] font-medium leading-tight transition sm:text-[12px]",
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
        {tab === "qr_tickets" ? (
          <div className="flex flex-col gap-4">
            <PayTickets userId={userId} />
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
