import Link from "next/link";
import { Clock, Gift, Instagram } from "lucide-react";
import type { LinkedCouponSummary } from "@/lib/mock/reservations-mock";
import { cn } from "@/lib/utils";
import { couponPath } from "@/lib/consumer-route-contract";

export function MetaRow({
  Icon,
  iconClass,
  label,
  value,
}: {
  Icon: typeof Clock;
  iconClass?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon
        className={cn("text-muted-foreground h-4 w-4", iconClass)}
        strokeWidth={2}
      />
      <span className="text-muted-foreground flex-1 text-[12px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className="text-foreground text-sm font-semibold">{value}</span>
    </div>
  );
}

export function LinkedCouponCard({ coupon }: { coupon: LinkedCouponSummary }) {
  const ig = coupon.kind === "instagram";
  return (
    <Link
      href={couponPath(coupon.id)}
      className="flex items-center gap-3 rounded-2xl border border-pink-500/15 bg-pink-500/[0.04] px-4 py-3.5 transition hover:bg-pink-500/[0.06]"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink-500/15 ring-1 ring-pink-500/20">
        {ig ? (
          <Instagram className="h-5 w-5 text-pink-600" strokeWidth={2} />
        ) : (
          <Gift className="h-5 w-5 text-pink-600" strokeWidth={2} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[9px] font-bold tracking-[0.18em] uppercase">
          Reward tied to this reservation
        </p>
        <p className="text-foreground mt-0.5 text-[14px] leading-tight font-semibold">
          <span className="text-pink-600">{coupon.percent}%</span> discount{" "}
          <span className="text-muted-foreground font-normal">
            · {coupon.classLabel}
          </span>
        </p>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
          coupon.state === "active"
            ? "border-emerald-500/30 bg-emerald-50 text-emerald-800"
            : "border-amber-500/30 bg-amber-50 text-amber-800",
        )}
      >
        {coupon.state === "active" ? "Active" : "Pending"}
      </span>
    </Link>
  );
}
