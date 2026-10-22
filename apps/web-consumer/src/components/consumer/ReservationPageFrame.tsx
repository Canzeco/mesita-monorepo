import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// The hard-nav reservation's frame (/reservation/[id]): its header (the back
// circle, a live link to Me; "Reservation" centred) and the scroller under
// it. The page and its loading.tsx (ReservationPageSkeleton) both draw THIS,
// so the header shown while it loads is the one that stays (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes"); the skeleton kept its own copy of it. A plain
// module, no "use client": the server page renders it as it is.
export function ReservationPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-full flex-col">
      <header className="bg-background/85 z-20 flex shrink-0 items-center gap-2 px-3 py-3 backdrop-blur">
        <Link
          href={CONSUMER_ROUTES.me}
          aria-label="Back to reservations"
          className="border-border bg-card text-foreground hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
        </Link>
        <p className="font-display flex-1 truncate text-center text-sm font-semibold">
          Reservation
        </p>
        <span className="h-9 w-9 shrink-0" aria-hidden />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
