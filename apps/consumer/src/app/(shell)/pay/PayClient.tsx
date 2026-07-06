"use client";

import dynamic from "next/dynamic";
import { MyQrCard } from "@/components/consumer/MyQrCard";
import { RewardsInfoBanner } from "@/components/consumer/RewardsInfoBanner";
import { PayTicketListSkeleton } from "./PayTabLoading";

// Rewards is a single page: the explainer banner, the Mesita passport card
// (QR + 8-digit code), then the tickets stack — one continuous scroll, no
// QR / Tickets toggle. Tickets carry their own dynamic() split so the ticket
// stack stays out of the initial page chunk.
const PayTickets = dynamic(
  () =>
    import("@/components/consumer/PayTickets").then((mod) => mod.PayTickets),
  {
    loading: () => <PayTicketListSkeleton />,
  },
);

export function PayClient({
  userId,
  code,
  name,
}: {
  userId: string;
  code: string;
  name?: string;
}) {
  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4 pb-6">
      <RewardsInfoBanner />

      <div className="mt-3">
        <MyQrCard code={code} name={name} />
      </div>

      <div className="mt-4">
        <PayTickets userId={userId} />
      </div>
    </div>
  );
}
