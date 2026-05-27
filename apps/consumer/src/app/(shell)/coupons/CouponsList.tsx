"use client";

import { useMemo, useState } from "react";
import { CouponCard } from "@/components/consumer/CouponCard";
import {
  MOCK_COUPONS,
  type CouponItem,
} from "@/lib/mock/coupons-mock";
import { cn } from "@/lib/utils";

// Coupons list on /coupons. Filter pills bucket the wallet across the
// union of both lifecycles (normal + instagram):
//
//   Active     normal:active                  + ig:verified | pending_story | under_review
//   Used       normal:redeemed                + ig:redeemed
//   Expired    normal:expired | cancelled     + ig:expired   | rejected

type Filter = "active" | "used" | "expired";

function bucket(c: CouponItem): Filter {
  if (c.kind === "normal") {
    if (c.status === "active") return "active";
    if (c.status === "redeemed") return "used";
    return "expired"; // expired | cancelled
  }
  // instagram
  if (
    c.status === "verified" ||
    c.status === "pending_story" ||
    c.status === "under_review"
  )
    return "active";
  if (c.status === "redeemed") return "used";
  return "expired"; // expired | rejected
}

export function CouponsList() {
  const [filter, setFilter] = useState<Filter>("active");

  const items = useMemo(
    () => MOCK_COUPONS.filter((c) => bucket(c) === filter),
    [filter],
  );

  const counts = useMemo(() => {
    return {
      active: MOCK_COUPONS.filter((c) => bucket(c) === "active").length,
      used: MOCK_COUPONS.filter((c) => bucket(c) === "used").length,
      expired: MOCK_COUPONS.filter((c) => bucket(c) === "expired").length,
    };
  }, []);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Your coupons
        </h2>
        <span className="text-muted-foreground text-[11px]">
          {counts.active} active
        </span>
      </header>

      <div className="border-border bg-card scrollbar-hide flex gap-1 overflow-x-auto rounded-full border p-1">
        {(
          [
            { id: "active", label: "Active", count: counts.active },
            { id: "used", label: "Used", count: counts.used },
            { id: "expired", label: "Expired", count: counts.expired },
          ] as { id: Filter; label: string; count: number }[]
        ).map((f) => (
          <FilterPill
            key={f.id}
            active={filter === f.id}
            onClick={() => setFilter(f.id)}
            label={f.label}
            count={f.count}
          />
        ))}
      </div>

      {items.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
          {filter === "active"
            ? "Save a venue and a coupon lands here."
            : filter === "used"
              ? "No coupons used yet."
              : "No expired coupons."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((c) => (
            <CouponCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </section>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition",
        active ? "bg-foreground text-background" : "text-muted-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0 text-[9px] font-bold",
          active
            ? "bg-background/20 text-background"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}
