"use client";

import { useRouter } from "next/navigation";
import { OFFER_TICKET_STEPS } from "@mesita/place-profile";
import { StepStrip, TicketHeader } from "@/components/consumer/pay/pay-flow";
import { goBack } from "@/lib/navigate";

// The voucher ticket's own placeholder (MESITA-4630): its header with ✕, the
// boxes in bones, the strip at step 1 over the button's bone.
export default function PlaceOfferLoading() {
  const router = useRouter();
  return (
    <div className="bg-card flex h-full min-h-0 flex-1 flex-col" aria-busy>
      <TicketHeader title="Offer" onClose={() => goBack(router)} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-4">
        <div className="bg-muted h-14 w-1/2 rounded-2xl" />
        <div className="bg-muted h-20 w-full rounded-2xl" />
        <div className="bg-muted h-48 w-full rounded-2xl" />
      </div>
      <div className="border-border flex shrink-0 flex-col gap-3 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <StepStrip at={1} steps={OFFER_TICKET_STEPS} />
        <div className="bg-muted h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
