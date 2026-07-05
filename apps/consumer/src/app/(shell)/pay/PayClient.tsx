"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MyQrCard } from "@/components/consumer/MyQrCard";
import { usePendingNotificationCount } from "@/lib/hooks/usePendingNotificationCount";
import { payTabHref, type PayTab } from "@/lib/pay-route";
import { PayTicketListSkeleton } from "./PayTabLoading";

const PayTickets = dynamic(
  () =>
    import("@/components/consumer/PayTickets").then((mod) => mod.PayTickets),
  {
    // Same silhouette PayTickets renders while its own fetch is pending, so
    // chunk-load → data-load reads as one continuous skeleton frame.
    loading: () => <PayTicketListSkeleton />,
  },
);

const TABS: { id: PayTab; label: string }[] = [
  { id: "qr", label: "QR" },
  { id: "tickets", label: "Tickets" },
];

export function PayClient({
  tab,
  userId,
  code,
  name,
}: {
  tab: PayTab;
  userId: string;
  code: string;
  name?: string;
}) {
  const router = useRouter();
  const pendingTickets = usePendingNotificationCount(userId);

  const selectTab = useCallback(
    (next: PayTab) => {
      const href = payTabHref(next);
      if (tab !== next) router.replace(href, { scroll: false });
    },
    [tab, router],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="px-4 pt-4">
        <div className="segment-control grid grid-cols-2 gap-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={cn(
                "segment-tab text-[11px] leading-tight sm:text-[12px]",
                tab === t.id ? "segment-tab-active" : "segment-tab-idle",
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
        {tab === "tickets" ? (
          <PayTickets userId={userId} />
        ) : (
          <MyQrCard code={code} name={name} />
        )}
      </div>
    </div>
  );
}
