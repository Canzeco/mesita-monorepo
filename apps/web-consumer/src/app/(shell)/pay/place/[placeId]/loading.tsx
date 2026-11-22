"use client";

import { useRouter } from "next/navigation";
import { BillStepBones } from "@/components/consumer/pay/GuestPayScreen";
import { TicketHeader } from "@/components/consumer/pay/pay-flow";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { goBack, navigateTo } from "@/lib/navigate";

// A place picked in Pay Bill's step 1 lands on step 2 at once (MESITA-4606):
// the ticket's own header with the Bill step's question, ← and ✕, over the
// step in bones, the steps at 2. The page draws the same frame while the
// place reads, so nothing else shows between the steps.
export default function Loading() {
  const router = useRouter();
  return (
    <div className="bg-card flex h-full min-h-0 flex-1 flex-col">
      <TicketHeader
        title="How much was your bill?"
        onBack={() => goBack(router)}
        onClose={() => navigateTo(router, CONSUMER_ROUTES.pay, { replace: true })}
        closeLabel="Close and discard this payment"
      />
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <BillStepBones />
      </div>
    </div>
  );
}
