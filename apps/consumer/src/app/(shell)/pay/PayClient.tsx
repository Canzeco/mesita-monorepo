"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MyQrCard } from "@/components/consumer/MyQrCard";
import { CashbackBalanceCard } from "@/components/consumer/CashbackBalanceCard";
import { PayTickets } from "@/components/consumer/PayTickets";
import { usePendingNotificationCount } from "@/lib/hooks/usePendingNotificationCount";

// Pay — three tabs: QR (code), Tickets (open visits), Balance (cashback).
type Tab = "qr" | "tickets" | "balance";

const TABS: { id: Tab; label: string }[] = [
  { id: "qr", label: "QR" },
  { id: "tickets", label: "Tickets" },
  { id: "balance", label: "Balance" },
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
  const [tab, setTab] = useState<Tab>("qr");
  const pendingTickets = usePendingNotificationCount(userId);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4">
        <div className="border-border bg-card grid grid-cols-3 gap-0 rounded-full border p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center justify-center gap-1 rounded-full px-1 py-1.5 text-center text-[11px] font-medium leading-tight transition sm:text-[12px]",
                tab === t.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="truncate">{t.label}</span>
              {t.id === "tickets" && pendingTickets > 0 ? (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                    tab === t.id
                      ? "bg-background/25 text-background"
                      : "bg-secondary text-background",
                  )}
                >
                  {pendingTickets > 9 ? "9+" : pendingTickets}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-6">
        {tab === "qr" ? (
          <MyQrCard code={code} />
        ) : tab === "tickets" ? (
          <PayTickets userId={userId} />
        ) : (
          <CashbackBalanceCard cashbackBalanceCents={cashbackBalanceCents} />
        )}
      </div>
    </div>
  );
}
