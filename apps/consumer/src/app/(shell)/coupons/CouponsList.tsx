"use client";

import { useState } from "react";
import { SavedItemCard } from "@/components/consumer/SavedItemCard";
import { TicketSheet } from "@/components/consumer/TicketSheet";
import { COUPONS } from "@/lib/consumer-data";
import type { SavedItem } from "@/lib/consumer-data";
import { cn } from "@/lib/utils";

// Coupons section of the /coupons page. Pulled into its own client
// component so the parent server page can stay async (auth + profile
// fetch). Mock data for now — once consumer-list-coupons is wired in
// (PR #27 in the entity-split sequence) this becomes an EF call.

type Filter = "active" | "used" | "expired";

export function CouponsList() {
  const [filter, setFilter] = useState<Filter>("active");
  const [openItem, setOpenItem] = useState<SavedItem | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Your coupons
        </h2>
        <span className="text-muted-foreground text-[11px]">
          {filter === "active" ? `${COUPONS.length} active` : ""}
        </span>
      </header>

      <div className="border-border bg-card scrollbar-hide flex gap-1 overflow-x-auto rounded-full border p-1">
        {(
          [
            { id: "active", label: "Active", count: 29 },
            { id: "used", label: "Used", count: 4 },
            { id: "expired", label: "Expired", count: 2 },
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

      {filter === "active" ? (
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
        <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
          {filter === "used" ? "No coupons used yet." : "No expired coupons."}
        </div>
      )}

      {openItem && (
        <TicketSheet item={openItem} onClose={() => setOpenItem(null)} />
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
