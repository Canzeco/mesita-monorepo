import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CouponDetailBody } from "@/components/consumer/CouponDetailBody";
import { getMockCouponById } from "@/lib/mock/coupons-mock";

export const dynamic = "force-dynamic";

// Hard-nav landing for /coupon/[id] (refresh, direct URL, new tab).
// Soft-nav from inside (shell) — tapping a card on /coupons — hits the
// intercepted variant at (shell)/@modal/(.)coupon/[id]/page.tsx which
// renders inside a modal on top of the underlying surface.
//
// Note the singular path: the list lives at /coupons (plural) and a
// single entry at /coupon/[id] (singular). Matches /venues + /venue/...
// style and /reservations + /reservation/[id] in this repo.
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
          href="/coupons"
          aria-label="Back to coupons"
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
