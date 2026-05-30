import Link from "next/link";
import { ClassChip } from "./ClassChip";
import { MesitaMark } from "./MesitaMark";
import { DiscoverTabs } from "./DiscoverTabs";

export function DiscoverHeader() {
  return (
    // Fixed h-16 (64px) to match SimpleHeader so the TopBar height is
    // identical across every top-level surface. Logo + the Swipe/Map/AI Search
    // tabs + class chip all center vertically inside the strict 64px row.
    // Discovery filters live in the BottomNav "Filters" sheet, not here.
    <div className="border-border/60 relative z-30 flex h-16 shrink-0 items-center border-b px-3">
      <div className="flex w-full items-center gap-2">
        <Link
          href="/profile"
          className="border-border bg-card shadow-glow text-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border p-2"
          aria-label="Mesita — profile"
        >
          <MesitaMark className="h-full w-full" />
        </Link>
        <DiscoverTabs />
        <ClassChip />
      </div>
    </div>
  );
}

// ClassChip moved to a shared component so /reservations, /coupons,
// /pay, /share can render the same tier-colored avatar via
// SimpleHeader. See src/components/consumer/ClassChip.tsx.
