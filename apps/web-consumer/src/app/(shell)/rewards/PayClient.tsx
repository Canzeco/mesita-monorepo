"use client";

import { useMemo } from "react";
import { MyQrCard } from "@/components/consumer/MyQrCard";
import { PayTickets } from "@/components/consumer/PayTickets";
import { RewardsTopCards } from "@/components/consumer/RewardsTopCards";
import {
  computeRewardStats,
  useConsumerPayTickets,
} from "@/lib/hooks/useConsumerPayTickets";

// Rewards is a single page: two top cards (Unlock Premium · How it works), the
// Mesita passport card (QR + code + identity + member stats), then the tickets
// stack — one continuous scroll. The ticket fetch is lifted into
// useConsumerPayTickets so the passport's stats and the list share one source.
export function PayClient({
  userId,
  code,
  name,
  instagramHandle,
}: {
  userId: string;
  code: string;
  name?: string;
  instagramHandle?: string | null;
}) {
  const tickets = useConsumerPayTickets(userId);
  const stats = useMemo(
    () => computeRewardStats(tickets.bundles, tickets.ticketMetaById),
    [tickets.bundles, tickets.ticketMetaById],
  );

  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-6">
      <RewardsTopCards />

      <MyQrCard
        code={code}
        name={name}
        instagramHandle={instagramHandle}
        stats={stats}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <PayTickets {...tickets} />
      </div>
    </div>
  );
}
