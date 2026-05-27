import { ClassUpsellBox } from "./ClassUpsellBox";
import { CouponsList } from "./CouponsList";

// /coupons — the coupons wallet. The QR-to-pay + cashback balance live
// at /pay; this surface is focused on browsing issued coupons. Top of
// the surface gets a ClassUpsellBox pitching the tier ladder — coupons
// are the most natural place to surface "Better class → bigger
// coupons" since the user is already thinking about reward value.
//
// Top header (SimpleHeader title="Coupons") is owned by the shell layout
// via TopBar — see src/components/consumer/TopBar.tsx.

export const dynamic = "force-dynamic";

export default function CouponsPage() {
  return (
    <div className="relative flex h-full flex-col">
      <div className="scrollbar-hide flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 px-4 pt-2 pb-6">
          <ClassUpsellBox />
          <CouponsList />
        </div>
      </div>
    </div>
  );
}
