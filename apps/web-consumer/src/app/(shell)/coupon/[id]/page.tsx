import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CouponDetailBody } from "@/components/consumer/CouponDetailBody";
import { getMockCouponById } from "@/lib/mock/coupons-mock";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// Hard-nav landing for /coupon/[id] (refresh, direct URL, new tab).
// Soft-nav from inside (shell) — tapping a coupon card — hits the
// intercepted variant at (shell)/@modal/(.)coupon/[id]/page.tsx which
// renders inside a modal on top of the underlying surface.
//
// There is deliberately NO /coupons list route: coupons are reached from
// reservations/tickets, so the back affordance targets Rewards (MESITA-899).
//
// Mocked: ids resolve through getMockCouponById; unknown ids 404.

export default async function CouponDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coupon = getMockCouponById(id);
  if (!coupon) notFound();

  return (
    <div className="relative flex h-full flex-col">
      <header className="bg-background/85 z-20 flex shrink-0 items-center gap-2 px-3 py-3 backdrop-blur">
        <Link
          href={CONSUMER_ROUTES.rewards.root}
          aria-label="Back to rewards"
          className="border-border bg-card text-foreground hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
        </Link>
        <p className="font-display flex-1 truncate text-center text-sm font-semibold">
          Coupon
        </p>
        <span className="h-9 w-9 shrink-0" aria-hidden />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CouponDetailBody c={coupon} />
      </div>
    </div>
  );
}
