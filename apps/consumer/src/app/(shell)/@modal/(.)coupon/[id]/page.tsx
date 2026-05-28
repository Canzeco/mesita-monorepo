import { notFound } from "next/navigation";
import { CouponDetailBody } from "@/components/consumer/CouponDetailBody";
import { CouponDetailModalShell } from "@/components/consumer/CouponDetailModalShell";
import { getMockCouponById } from "@/lib/mock/coupons-mock";

export const dynamic = "force-dynamic";

// Intercepted /coupon/[id]. Fires only on soft navigation from inside
// (shell) — e.g. tapping a coupon card on /coupons. The underlying list
// stays mounted; this renders inside the @modal slot on top.
//
// Hard navigation (refresh, direct URL, new tab) bypasses the
// interceptor and lands on src/app/(shell)/coupon/[id]/page.tsx — the
// full page.

export default async function CouponModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coupon = getMockCouponById(id);
  if (!coupon) notFound();

  return (
    <CouponDetailModalShell venueName={coupon.venueName}>
      <CouponDetailBody c={coupon} />
    </CouponDetailModalShell>
  );
}
