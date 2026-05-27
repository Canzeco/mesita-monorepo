import { SimpleHeader } from "@/components/consumer/SimpleHeader";
import { CouponsList } from "./CouponsList";

// /coupons — just the coupons wallet now. The QR-to-pay + cashback
// balance moved out to /pay when the BottomNav split Pay from Coupons.
// Keeping the wallet focused on its single job (browse my issued
// coupons) reads cleaner and stops mixing scan-at-the-bill intent with
// browse-my-deals intent.

export const dynamic = "force-dynamic";

export default function CouponsPage() {
  return (
    <div className="relative flex h-full flex-col">
      <SimpleHeader title="Coupons" />
      <div className="scrollbar-hide flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 px-4 pt-2 pb-6">
          <CouponsList />
        </div>
      </div>
    </div>
  );
}
