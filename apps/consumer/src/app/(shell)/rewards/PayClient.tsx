"use client";

import dynamic from "next/dynamic";
import { MyQrCard } from "@/components/consumer/MyQrCard";
import { PayTicketListSkeleton } from "./PayTabLoading";

// Rewards is a single page: the Mesita passport card (QR/passport on the left,
// how-rewards-work info on the right), then the tickets stack — one continuous
// scroll. Tickets carry their own dynamic() split so the ticket stack stays
// out of the initial page chunk.
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
      <MyQrCard code={code} name={name} />

      <div className="mt-4">
        <PayTickets userId={userId} />
      </div>
    </div>
  );
}
