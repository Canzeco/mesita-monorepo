"use client";

import { useState } from "react";
import { SimpleHeader } from "@/components/guest/SimpleHeader";
import { SavedItemCard } from "@/components/guest/SavedItemCard";
import { TicketSheet } from "@/components/guest/TicketSheet";
import { RESERVATIONS, COUPONS } from "@/lib/guest-data";
import type { SavedItem } from "@/lib/guest-data";
import { cn } from "@/lib/utils";

type Tab = "reservations" | "coupons";
type ResFilter = "upcoming" | "past" | "cancelled";
type CouponFilter = "active" | "used" | "expired";

export default function SavedPage() {
  const [tab, setTab] = useState<Tab>("reservations");
  const [resFilter, setResFilter] = useState<ResFilter>("upcoming");
  const [couponFilter, setCouponFilter] = useState<CouponFilter>("active");
  const [openItem, setOpenItem] = useState<SavedItem | null>(null);

  return (
    <div className="relative flex h-full flex-col">
      <SimpleHeader title="Mesita" eyebrow="Reservations & Coupons" />

      <div className="px-4 pt-3">
        <p className="bg-secondary/10 text-secondary rounded-xl px-3 py-2 text-[11px]">
          Preview — reservations and coupons aren&apos;t connected to the
          backend yet. The flow below is a sketch of what&apos;s coming.
        </p>
      </div>

      <div className="px-4 pt-4">
        <div className="border-border bg-card flex rounded-full border p-1">
          <TabButton
            active={tab === "reservations"}
            onClick={() => setTab("reservations")}
            label="Reservations"
            count={8}
          />
          <TabButton
            active={tab === "coupons"}
            onClick={() => setTab("coupons")}
            label="Coupons"
            count={35}
          />
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="border-border bg-card scrollbar-hide flex gap-1 overflow-x-auto rounded-full border p-1">
          {tab === "reservations"
            ? (
                [
                  { id: "upcoming", label: "Upcoming", count: 4 },
                  { id: "past", label: "Past", count: 2 },
                  { id: "cancelled", label: "Cancelled", count: 2 },
                ] as { id: ResFilter; label: string; count: number }[]
              ).map((f) => (
                <FilterPill
                  key={f.id}
                  active={resFilter === f.id}
                  onClick={() => setResFilter(f.id)}
                  label={f.label}
                  count={f.count}
                />
              ))
            : (
                [
                  { id: "active", label: "Active", count: 29 },
                  { id: "used", label: "Used", count: 4 },
                  { id: "expired", label: "Expired", count: 2 },
                ] as { id: CouponFilter; label: string; count: number }[]
              ).map((f) => (
                <FilterPill
                  key={f.id}
                  active={couponFilter === f.id}
                  onClick={() => setCouponFilter(f.id)}
                  label={f.label}
                  count={f.count}
                />
              ))}
        </div>
      </div>

      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 py-4">
        {tab === "reservations" ? (
          resFilter === "upcoming" ? (
            <div className="flex flex-col gap-3">
              {RESERVATIONS.map((r) => (
                <SavedItemCard
                  key={r.id}
                  item={r}
                  onClick={() => setOpenItem(r)}
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          )
        ) : couponFilter === "active" ? (
          <div className="flex flex-col gap-3">
            {COUPONS.map((c) => (
              <SavedItemCard
                key={c.id}
                item={c}
                onClick={() => setOpenItem(c)}
              />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      {openItem && (
        <TicketSheet item={openItem} onClose={() => setOpenItem(null)} />
      )}
    </div>
  );
}

function TabButton({
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
        "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
        active ? "bg-foreground text-background" : "text-muted-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
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

function EmptyState() {
  return (
    <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
      Nothing here yet.
    </div>
  );
}
